import { useCallback, useEffect, useRef, useState } from 'react';
import type { BleManager, Device, Subscription } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { BLEStatus, RepData } from '../lib/types';
import {
  DEVICE_NAME,
  REP_CHARACTERISTIC_UUID,
  SMART_COUNTER_SERVICE_UUID,
} from '../lib/bleConstants';

let manager: BleManager | null = null;

function getManager() {
  if (!manager) {
    const { BleManager } = require('react-native-ble-plx') as typeof import('react-native-ble-plx');
    manager = new BleManager();
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
      getManager().stopDeviceScan();
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
      bleManager = getManager();
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
        getManager().stopDeviceScan();
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
