import { StyleSheet, Text, View } from 'react-native';

interface Props {
  reps: number;
  lastDurationMs: number | null;
}

export function RepCounter({ reps, lastDurationMs }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>REPS</Text>
      <Text style={styles.count}>{reps}</Text>
      {lastDurationMs !== null && (
        <Text style={styles.duration}>Last rep: {(lastDurationMs / 1000).toFixed(1)}s</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginVertical: 32 },
  label: { color: '#555555', fontSize: 12, letterSpacing: 3, marginBottom: 8 },
  count: { color: '#e8f542', fontSize: 96, fontWeight: '700', lineHeight: 100 },
  duration: { color: '#888888', fontSize: 14, marginTop: 8 },
});
