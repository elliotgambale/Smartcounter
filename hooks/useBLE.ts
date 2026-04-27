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

const SMART_COUNTER_SERVICE_PREFIX = '4faf';

const manager =
  Constants.appOwnership === 'expo'
    ? null
    : new BleManager({
        restoreStateIdentifier: 'smartcounter-ble',
        restoreStateFunction: () => null,
      });

function requireManager() {
  if (!manager) {
    throw new Error('BLE is unavailable in Expo Go. Use a native development build.');
  }
  return manager;
}

function hasSmartCounterService(device: Device) {
  return device.serviceUUIDs?.some((uuid) =>
    uuid.toLowerCase().startsWith(SMART_COUNTER_SERVICE_PREFIX)
  ) ?? false;
}

function isSmartCounterDevice(device: Device) {
  return (
    device.name === DEVICE_NAME ||
    device.localName === DEVICE_NAME ||
    hasSmartCounterService(device)
  );
}

function sortDevices(devices: Device[]) {
  return [...devices].sort((a, b) => {
    const aSmartCounter = isSmartCounterDevice(a);
    const bSmartCounter = isSmartCounterDevice(b);

    if (aSmartCounter !== bSmartCounter) {
      return aSmartCounter ? -1 : 1;
    }

    return (b.rssi ?? -999) - (a.rssi ?? -999);
  });
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
    console.log('[BLE] starting scan');

    let bleManager: BleManager;
    try {
      bleManager = requireManager();
    } catch {
      setStatus('error');
      console.log('[BLE] manager unavailable in current runtime');
      return;
    }

    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        setStatus('error');
        console.log('[BLE] scan error', error);
        return;
      }

      if (device) {
        console.log('[BLE] scan hit', {
          id: device.id,
          name: device.name,
          localName: device.localName,
          serviceUUIDs: device.serviceUUIDs,
          rssi: device.rssi,
        });
      }

      if (device) {
        setDevices((prev) => {
          const existingIndex = prev.findIndex((d) => d.id === device.id);

          if (existingIndex === -1) {
            return sortDevices([...prev, device]);
          }

          const next = [...prev];
          next[existingIndex] = device;
          return sortDevices(next);
        });

        if (isSmartCounterDevice(device)) {
          console.log('[BLE] matched SmartCounter device', {
            id: device.id,
            name: device.name,
            localName: device.localName,
            serviceUUIDs: device.serviceUUIDs,
          });
        }
      }
    });

    scanTimeoutRef.current = setTimeout(() => {
      bleManager.stopDeviceScan();
      console.log('[BLE] scan stopped after timeout');
      setStatus((current) => (current === 'scanning' ? 'idle' : current));
      scanTimeoutRef.current = null;
    }, 10000);
  }, []);

  const connectToDevice = useCallback(
    async (device: Device) => {
      setStatus('connecting');
      console.log('[BLE] connecting to device', {
        id: device.id,
        name: device.name,
        localName: device.localName,
      });

      try {
        requireManager().stopDeviceScan();
        const connected = await device.connect();
        console.log('[BLE] connected', {
          id: connected.id,
          name: connected.name,
          localName: connected.localName,
        });
        await connected.discoverAllServicesAndCharacteristics();
        console.log('[BLE] discovered services and characteristics');
        setConnectedDevice(connected);
        setStatus('connected');

        subscriptionRef.current = connected.monitorCharacteristicForService(
          SMART_COUNTER_SERVICE_UUID,
          REP_CHARACTERISTIC_UUID,
          (error, characteristic) => {
            if (error) {
              console.log('[BLE] notification error', error);
              return;
            }

            if (!characteristic?.value) {
              console.log('[BLE] notification received with empty value');
              return;
            }

            const bytes = Buffer.from(characteristic.value, 'base64');
            console.log('[BLE] notification raw', {
              base64: characteristic.value,
              byteLength: bytes.length,
            });
            const repData: RepData = {
              set: bytes.readUInt32LE(0),
              rep: bytes.readUInt32LE(4),
              durationMs: bytes.readUInt32LE(8),
              timestamp: Date.now(),
            };

            console.log('[BLE] parsed repData', repData);
            onRepReceived(repData);
          }
        );
        console.log('[BLE] subscribed to rep notifications', {
          service: SMART_COUNTER_SERVICE_UUID,
          characteristic: REP_CHARACTERISTIC_UUID,
        });

        disconnectRef.current = connected.onDisconnected(() => {
          setStatus('disconnected');
          setConnectedDevice(null);
          subscriptionRef.current?.remove();
          subscriptionRef.current = null;
          console.log('[BLE] device disconnected');
        });
      } catch {
        setStatus('error');
        console.log('[BLE] failed to connect or subscribe');
      }
    },
    [onRepReceived]
  );

  const disconnect = useCallback(async () => {
    console.log('[BLE] disconnect requested');
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    disconnectRef.current?.remove();
    disconnectRef.current = null;

    if (connectedDevice) {
      await connectedDevice.cancelConnection();
      console.log('[BLE] connection cancelled', { id: connectedDevice.id });
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
