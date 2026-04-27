import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Device } from 'react-native-ble-plx';
import { DEVICE_NAME } from '../lib/bleConstants';

const SMART_COUNTER_SERVICE_PREFIX = '4faf';

interface Props {
  device: Device;
  onConnect: () => void;
}

export function DeviceCard({ device, onConnect }: Props) {
  const displayName = device.name ?? device.localName ?? 'Unknown BLE device';
  const matchingService = device.serviceUUIDs?.find((uuid) =>
    uuid.toLowerCase().startsWith(SMART_COUNTER_SERVICE_PREFIX)
  );
  const isSmartCounter =
    device.name === DEVICE_NAME || device.localName === DEVICE_NAME || Boolean(matchingService);

  return (
    <View style={styles.card}>
      <View style={styles.meta}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          {isSmartCounter && <Text style={styles.badge}>SmartCounter</Text>}
        </View>
        {device.name && device.localName && device.name !== device.localName && (
          <Text style={styles.detail} numberOfLines={1}>
            Local name: {device.localName}
          </Text>
        )}
        <Text style={styles.id} numberOfLines={1}>
          {device.id}
        </Text>
        <Text style={styles.detail}>
          RSSI: {device.rssi ?? 'unknown'}
        </Text>
        {matchingService && (
          <Text style={styles.detail} numberOfLines={1}>
            Service: {matchingService}
          </Text>
        )}
      </View>
      <TouchableOpacity style={styles.button} onPress={onConnect}>
        <Text style={styles.buttonText}>Connect</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#222222',
    gap: 12,
  },
  meta: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: '#ffffff', fontSize: 15, fontWeight: '500', flexShrink: 1 },
  badge: {
    color: '#0a0a0a',
    backgroundColor: '#e8f542',
    borderRadius: 6,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: '800',
  },
  id: { color: '#555555', fontSize: 11, marginTop: 2 },
  detail: { color: '#777777', fontSize: 11, marginTop: 2 },
  button: {
    backgroundColor: '#e8f542',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  buttonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '700' },
});
