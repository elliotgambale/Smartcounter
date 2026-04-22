import { useCallback, useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { BLEStatus, RepData } from '../lib/types';
import {
  DEVICE_NAME,
  REP_CHARACTERISTIC_UUID,
  SMART_COUNTER_SERVICE_UUID,
} from '../lib/bleConstants';

const manager = Constants.appOwnership === 'expo' ? null : new BleManager();

function requireManager() {
  if (!manager) {
    throw new Error('BLE is unavailable in Expo Go. Use a native development build.');
  }
  return manager;
}

export function useBLE(onRepReceived: (rep: RepData) => void) {
  const [status, setStatus] = useState<BLEStatus>('idle');
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const subscriptionRef = useRef<Subscription | null>(null);
  const disconnectRef = useRef<Subscription | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopScan = useCallback(() => {
    try {
      requireManager().stopDeviceScan();
    } catch {
      setStatus('error');
    }
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setStatus((current) => (current === 'scanning' ? 'idle' : current));
  }, []);

  const startScan = useCallback(() => {
    setStatus('scanning');
    setDevices([]);

    let bleManager: BleManager;
    try {
      bleManager = requireManager();
    } catch {
      setStatus('error');
      return;
    }

    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        setStatus('error');
        return;
      }

      if (device && device.name === DEVICE_NAME) {
        setDevices((prev) => {
          const exists = prev.find((d) => d.id === device.id);
          return exists ? prev : [...prev, device];
        });
      }
    });

    scanTimeoutRef.current = setTimeout(() => {
      bleManager.stopDeviceScan();
      setStatus((current) => (current === 'scanning' ? 'idle' : current));
      scanTimeoutRef.current = null;
    }, 10000);
  }, []);

  const connectToDevice = useCallback(
    async (device: Device) => {
      setStatus('connecting');

      try {
        requireManager().stopDeviceScan();
        const connected = await device.connect();
        await connected.discoverAllServicesAndCharacteristics();
        setConnectedDevice(connected);
        setStatus('connected');

        subscriptionRef.current = connected.monitorCharacteristicForService(
          SMART_COUNTER_SERVICE_UUID,
          REP_CHARACTERISTIC_UUID,
          (error, characteristic) => {
            if (error || !characteristic?.value) return;

            const bytes = Buffer.from(characteristic.value, 'base64');
            const repData: RepData = {
              set: bytes.readUInt32LE(0),
              rep: bytes.readUInt32LE(4),
              durationMs: bytes.readUInt32LE(8),
              timestamp: Date.now(),
            };

            onRepReceived(repData);
          }
        );

        disconnectRef.current = connected.onDisconnected(() => {
          setStatus('disconnected');
          setConnectedDevice(null);
          subscriptionRef.current?.remove();
          subscriptionRef.current = null;
        });
      } catch {
        setStatus('error');
      }
    },
    [onRepReceived]
  );

  const disconnect = useCallback(async () => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    disconnectRef.current?.remove();
    disconnectRef.current = null;

    if (connectedDevice) {
      await connectedDevice.cancelConnection();
      setConnectedDevice(null);
    }

    setStatus('idle');
  }, [connectedDevice]);

  useEffect(() => {
    return () => {
      manager?.stopDeviceScan();
      subscriptionRef.current?.remove();
      disconnectRef.current?.remove();
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  }, []);

  return {
    status,
    devices,
    connectedDevice,
    startScan,
    stopScan,
    connectToDevice,
    disconnect,
  };
}
