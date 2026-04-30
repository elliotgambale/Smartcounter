import Constants from 'expo-constants';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Buffer } from 'buffer';
import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import {
  DEVICE_NAME,
  REP_CHARACTERISTIC_UUID,
  SMART_COUNTER_SERVICE_UUID,
} from '../lib/bleConstants';
import { BLEStatus, RepData } from '../lib/types';

const SMART_COUNTER_SERVICE_PREFIX = '4faf';
const IS_EXPO_GO = Constants.appOwnership === 'expo';

const manager = IS_EXPO_GO
  ? null
  : new BleManager({
      restoreStateIdentifier: 'smartcounter-ble',
      restoreStateFunction: () => null,
    });

interface BLEContextValue {
  status: BLEStatus;
  devices: Device[];
  connectedDevice: Device | null;
  lastRep: RepData | null;
  debugLogs: string[];
  startScan: () => void;
  stopScan: () => void;
  connectToDevice: (device: Device) => Promise<void>;
  disconnect: () => Promise<void>;
}

const BLEContext = createContext<BLEContextValue | null>(null);

function hasSmartCounterService(device: Device) {
  return (
    device.serviceUUIDs?.some((uuid) =>
      uuid.toLowerCase().startsWith(SMART_COUNTER_SERVICE_PREFIX)
    ) ?? false
  );
}

function isSmartCounterDevice(device: Device) {
  return device.name === DEVICE_NAME || device.localName === DEVICE_NAME || hasSmartCounterService(device);
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

function formatBytes(bytes: Buffer) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join(' ');
}

function formatTimestamp() {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const millis = now.getMilliseconds().toString().padStart(3, '0');

  return `${hours}:${minutes}:${seconds}.${millis}`;
}

function formatDebugData(data: unknown) {
  if (data === undefined) return '';
  if (typeof data === 'string') return ` ${data}`;
  if (typeof data === 'number' || typeof data === 'boolean') return ` ${data}`;

  try {
    return ` ${JSON.stringify(data)}`;
  } catch {
    return ` ${String(data)}`;
  }
}

function parseRepPacket(value: string): { repData: RepData | null; reason?: string; bytes: Buffer } {
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length < 12) {
    return { repData: null, reason: `too short BLE packet: ${bytes.length} bytes`, bytes };
  }

  const repData: RepData = {
    set: bytes.readUInt32LE(0),
    rep: bytes.readUInt32LE(4),
    durationMs: bytes.readUInt32LE(8),
    timestamp: Date.now(),
  };

  if (repData.set < 1 || repData.rep < 1 || repData.durationMs < 100) {
    return {
      repData: null,
      reason: `sanity check failed — Set: ${repData.set}  Rep: ${repData.rep}  Duration: ${repData.durationMs}ms`,
      bytes,
    };
  }

  return { repData, bytes };
}

export function BLEProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<BLEStatus>('idle');
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [lastRep, setLastRep] = useState<RepData | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const subscriptionRef = useRef<Subscription | null>(null);
  const disconnectRef = useRef<Subscription | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logDebug = useCallback((message: string, data?: unknown) => {
    const line = `${formatTimestamp()} -> ${message}${formatDebugData(data)}`;

    console.log(`[SmartCounter BLE] ${message}`, data ?? '');
    setDebugLogs((prev) => [line, ...prev].slice(0, 30));
  }, []);

  const stopScan = useCallback(() => {
    if (!manager) {
      setStatus('error');
      logDebug('BLE unavailable — native manager missing');
      return;
    }

    manager.stopDeviceScan();
    logDebug('Scan stopped');
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setStatus((current) => (current === 'scanning' ? 'idle' : current));
  }, []);

  const startScan = useCallback(() => {
    if (!manager) {
      setStatus('error');
      logDebug('BLE unavailable — native manager missing');
      return;
    }

    setStatus('scanning');
    setDevices([]);
    logDebug('Scan started');
    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        setStatus('error');
        logDebug('Scan error —', {
          message: error.message,
          errorCode: error.errorCode,
          reason: error.reason,
        });
        return;
      }

      if (!device || !isSmartCounterDevice(device)) return;

      logDebug(
        'SmartCounter found —',
        `Name: ${device.name ?? device.localName ?? 'unknown'}  RSSI: ${device.rssi ?? 'unknown'}`
      );

      setDevices((prev) => {
        const existingIndex = prev.findIndex((d) => d.id === device.id);

        if (existingIndex === -1) {
          return sortDevices([...prev, device]);
        }

        const next = [...prev];
        next[existingIndex] = device;
        return sortDevices(next);
      });
    });

    scanTimeoutRef.current = setTimeout(() => {
      manager.stopDeviceScan();
      logDebug('Scan stopped — timeout after 10s');
      setStatus((current) => (current === 'scanning' ? 'idle' : current));
      scanTimeoutRef.current = null;
    }, 10000);
  }, [logDebug]);

  const connectToDevice = useCallback(async (device: Device) => {
    if (!manager) {
      setStatus('error');
      logDebug('BLE unavailable — native manager missing');
      return;
    }

    manager.stopDeviceScan();
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setStatus('connecting');
    logDebug(
      'Connecting —',
      `Name: ${device.name ?? device.localName ?? 'unknown'}  ID: ${device.id}`
    );

    try {
      subscriptionRef.current?.remove();
      disconnectRef.current?.remove();

      const connected = await device.connect();
      await connected.discoverAllServicesAndCharacteristics();
      setConnectedDevice(connected);
      setStatus('connected');
      logDebug('Connected —', `ID: ${connected.id}`);

      try {
        const services = await connected.services();
        logDebug('Services discovered —', services.map((service) => service.uuid).join(', '));
      } catch (serviceError) {
        logDebug(
          'Service list failed —',
          serviceError instanceof Error ? serviceError.message : String(serviceError)
        );
      }

      try {
        const characteristics = await connected.characteristicsForService(SMART_COUNTER_SERVICE_UUID);
        logDebug(
          'SmartCounter characteristics —',
          characteristics
            .map(
              (characteristic) =>
                `${characteristic.uuid} notify:${characteristic.isNotifiable} notifying:${characteristic.isNotifying}`
            )
            .join(' | ')
        );
      } catch (characteristicError) {
        logDebug(
          'Characteristic list failed —',
          characteristicError instanceof Error
            ? characteristicError.message
            : String(characteristicError)
        );
      }

      subscriptionRef.current = connected.monitorCharacteristicForService(
        SMART_COUNTER_SERVICE_UUID,
        REP_CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error) {
            logDebug('Notification error —', {
              message: error.message,
              errorCode: error.errorCode,
              reason: error.reason,
            });
            return;
          }

          if (!characteristic?.value) {
            logDebug('Ignored — notification received with empty value');
            return;
          }

          try {
            const { repData, reason, bytes } = parseRepPacket(characteristic.value);

            logDebug(
              'BLE notify received —',
              `${bytes.length} bytes  hex: ${formatBytes(bytes)}`
            );

            if (!repData) {
              logDebug('Ignored —', reason);
              return;
            }

            logDebug(
              'Rep received —',
              `Set: ${repData.set}  Rep: ${repData.rep}  Duration: ${repData.durationMs}ms`
            );
            setLastRep(repData);
          } catch (parseError) {
            console.warn('Failed to parse BLE packet:', parseError);
            logDebug(
              'Ignored — packet parse exception:',
              parseError instanceof Error ? parseError.message : String(parseError)
            );
          }
        }
      );
      logDebug(
        'Subscribed to rep notifications —',
        `Service: ${SMART_COUNTER_SERVICE_UUID}  Characteristic: ${REP_CHARACTERISTIC_UUID}`
      );

      setTimeout(async () => {
        try {
          const isStillConnected = await connected.isConnected();
          const characteristics = await connected.characteristicsForService(SMART_COUNTER_SERVICE_UUID);
          const repCharacteristic = characteristics.find(
            (characteristic) =>
              characteristic.uuid.toLowerCase() === REP_CHARACTERISTIC_UUID.toLowerCase()
          );

          logDebug(
            'Subscription check —',
            `connected:${isStillConnected} notify:${repCharacteristic?.isNotifiable} notifying:${repCharacteristic?.isNotifying}`
          );
        } catch (subscriptionCheckError) {
          logDebug(
            'Subscription check failed —',
            subscriptionCheckError instanceof Error
              ? subscriptionCheckError.message
              : String(subscriptionCheckError)
          );
        }
      }, 1000);

      disconnectRef.current = connected.onDisconnected(() => {
        setStatus('disconnected');
        setConnectedDevice(null);
        subscriptionRef.current?.remove();
        subscriptionRef.current = null;
        disconnectRef.current?.remove();
        disconnectRef.current = null;
        logDebug('Device disconnected');
      });
    } catch (connectError) {
      console.error('BLE connect error:', connectError);
      setStatus('error');
      logDebug(
        'Connect failed —',
        connectError instanceof Error ? connectError.message : String(connectError)
      );
    }
  }, [logDebug]);

  const disconnect = useCallback(async () => {
    logDebug('Disconnect requested');
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    disconnectRef.current?.remove();
    disconnectRef.current = null;

    if (connectedDevice) {
      try {
        await connectedDevice.cancelConnection();
      } catch {
        // The device may already be disconnected.
      }
      setConnectedDevice(null);
      logDebug('Connection cancelled —', `ID: ${connectedDevice.id}`);
    }

    setStatus('idle');
  }, [connectedDevice, logDebug]);

  useEffect(() => {
    return () => {
      subscriptionRef.current?.remove();
      disconnectRef.current?.remove();
      manager?.stopDeviceScan();
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  }, []);

  return (
    <BLEContext.Provider
      value={{
        status,
        devices,
        connectedDevice,
        lastRep,
        debugLogs,
        startScan,
        stopScan,
        connectToDevice,
        disconnect,
      }}
    >
      {children}
    </BLEContext.Provider>
  );
}

export function useBLEContext(): BLEContextValue {
  const ctx = useContext(BLEContext);
  if (!ctx) throw new Error('useBLEContext must be used inside BLEProvider');
  return ctx;
}
