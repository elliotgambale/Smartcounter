import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Device } from 'react-native-ble-plx';
import { DeviceCard } from '../components/DeviceCard';
import { useBLE } from '../hooks/useBLE';

export default function HomeScreen() {
  const router = useRouter();
  const { status, devices, startScan, stopScan, connectToDevice } = useBLE(() => {});

  const handleConnect = async (device: Device) => {
    await connectToDevice(device);
    router.push('/workout');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>Find your ESP32 device to begin</Text>

      <TouchableOpacity
        style={[styles.scanButton, status === 'scanning' && styles.scanButtonActive]}
        onPress={status === 'scanning' ? stopScan : startScan}
      >
        {status === 'scanning' ? (
          <ActivityIndicator color="#0a0a0a" />
        ) : (
          <Text style={styles.scanButtonText}>
            {status === 'idle' ? 'Scan for devices' : 'Scan again'}
          </Text>
        )}
      </TouchableOpacity>

      {devices.length === 0 && status !== 'scanning' && (
        <Text style={styles.hint}>No devices found yet. Make sure your ESP32 is powered on.</Text>
      )}

      <FlatList
        data={devices}
        keyExtractor={(device) => device.id}
        renderItem={({ item }) => (
          <DeviceCard device={item} onConnect={() => handleConnect(item)} />
        )}
        style={styles.list}
      />

      <TouchableOpacity style={styles.historyLink} onPress={() => router.push('/history')}>
        <Text style={styles.historyLinkText}>View session history</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.mockLink} onPress={() => router.push('/workout')}>
        <Text style={styles.mockLinkText}>Open mock workout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#0a0a0a' },
  subtitle: { color: '#888888', fontSize: 15, marginBottom: 28 },
  scanButton: {
    backgroundColor: '#e8f542',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  scanButtonActive: { backgroundColor: '#c8d530' },
  scanButtonText: { color: '#0a0a0a', fontSize: 16, fontWeight: '700' },
  hint: { color: '#555555', fontSize: 13, textAlign: 'center', marginTop: 16 },
  list: { marginTop: 12 },
  historyLink: { alignItems: 'center', paddingVertical: 20 },
  historyLinkText: { color: '#888888', fontSize: 14 },
  mockLink: { alignItems: 'center', paddingBottom: 20 },
  mockLinkText: { color: '#e8f542', fontSize: 14, fontWeight: '700' },
});
