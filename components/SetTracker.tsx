import { StyleSheet, Text, View } from 'react-native';

interface Props {
  currentSet: number;
  totalSets: number;
}

export function SetTracker({ currentSet, totalSets }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.box}>
        <Text style={styles.label}>CURRENT SET</Text>
        <Text style={styles.value}>{currentSet}</Text>
      </View>
      <View style={styles.box}>
        <Text style={styles.label}>SETS DONE</Text>
        <Text style={styles.value}>{Math.max(0, totalSets - 1)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  box: {
    flex: 1,
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222222',
  },
  label: { color: '#555555', fontSize: 11, letterSpacing: 2, marginBottom: 8 },
  value: { color: '#ffffff', fontSize: 36, fontWeight: '600' },
});
