import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Device } from 'react-native-ble-plx';

interface Props {
  device: Device;
  onConnect: () => void;
}

export function DeviceCard({ device, onConnect }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.meta}>
        <Text style={styles.name}>{device.name ?? 'Unknown device'}</Text>
        <Text style={styles.id} numberOfLines={1}>
          {device.id}
        </Text>
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
  name: { color: '#ffffff', fontSize: 15, fontWeight: '500' },
  id: { color: '#555555', fontSize: 11, marginTop: 2 },
  button: {
    backgroundColor: '#e8f542',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  buttonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '700' },
});
