import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Device } from 'react-native-ble-plx';
import { DeviceCard } from '../components/DeviceCard';
import { useBLE } from '../hooks/useBLE';

export default function HomeScreen() {
  const router = useRouter();
  const { status, devices, startScan, stopScan, connectToDevice } = useBLE(() => {});
  const isScanning = status === 'scanning';

  const handleConnect = async (device: Device) => {
    await connectToDevice(device);
    router.push('/workout');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SmartCounter</Text>
      <Text style={styles.subtitle}>Connect to your ESP32 counter to begin.</Text>

      <View style={styles.discoveryPanel}>
        <View style={styles.discoveryHeader}>
          <View>
            <Text style={styles.discoveryTitle}>Bluetooth Discovery</Text>
            <Text style={styles.discoveryStatus}>
              {isScanning
                ? 'Searching for SmartCounter devices...'
                : `${devices.length} device${devices.length === 1 ? '' : 's'} found`}
            </Text>
          </View>
          {isScanning && <ActivityIndicator color="#e8f542" />}
        </View>

        <TouchableOpacity
          style={[styles.scanButton, isScanning && styles.scanButtonActive]}
          onPress={isScanning ? stopScan : startScan}
        >
          <Text style={[styles.scanButtonText, isScanning && styles.scanButtonActiveText]}>
            {isScanning ? 'Stop Bluetooth Search' : 'Start Bluetooth Search'}
          </Text>
        </TouchableOpacity>
      </View>

      {devices.length === 0 && !isScanning && (
        <Text style={styles.hint}>Make sure your ESP32 is powered on before starting search.</Text>
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
  title: { color: '#ffffff', fontSize: 28, fontWeight: '800', marginBottom: 6 },
  subtitle: { color: '#888888', fontSize: 15, marginBottom: 22 },
  discoveryPanel: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#262626',
  },
  discoveryHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  discoveryTitle: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  discoveryStatus: { color: '#888888', fontSize: 13, marginTop: 4 },
  scanButton: {
    backgroundColor: '#e8f542',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  scanButtonActive: { backgroundColor: '#242424', borderWidth: 1, borderColor: '#3a3a3a' },
  scanButtonText: { color: '#0a0a0a', fontSize: 16, fontWeight: '700' },
  scanButtonActiveText: { color: '#e8f542' },
  hint: { color: '#555555', fontSize: 13, textAlign: 'center', marginTop: 16 },
  list: { marginTop: 12 },
  historyLink: { alignItems: 'center', paddingVertical: 20 },
  historyLinkText: { color: '#888888', fontSize: 14 },
  mockLink: { alignItems: 'center', paddingBottom: 20 },
  mockLinkText: { color: '#e8f542', fontSize: 14, fontWeight: '700' },
});
