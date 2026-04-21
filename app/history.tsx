import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { clearSessions, getSessions } from '../lib/storage';
import { WorkoutSession } from '../lib/types';

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);

  useEffect(() => {
    getSessions().then(setSessions);
  }, []);

  const handleClear = () => {
    Alert.alert('Clear history', 'Delete all sessions?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await clearSessions();
          setSessions([]);
        },
      },
    ]);
  };

  if (sessions.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No sessions yet.</Text>
        <Text style={styles.emptySubtext}>Complete a workout to see your history here.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sessions}
        keyExtractor={(session) => session.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.date}>{item.date}</Text>
            <Text style={styles.stat}>
              {item.sets.length} sets | {item.totalReps} reps
            </Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
      />
      <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
        <Text style={styles.clearText}>Clear all history</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  emptyText: { color: '#ffffff', fontSize: 18, fontWeight: '600' },
  emptySubtext: { color: '#555555', marginTop: 8, fontSize: 14 },
  listContent: { padding: 24 },
  card: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222222',
  },
  date: { color: '#ffffff', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  stat: { color: '#888888', fontSize: 13 },
  clearButton: { padding: 24, alignItems: 'center' },
  clearText: { color: '#f87171', fontSize: 14 },
});
