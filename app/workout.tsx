import { useEffect, useRef } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FatigueChart } from '../components/FatigueChart';
import { RepCounter } from '../components/RepCounter';
import { SetTracker } from '../components/SetTracker';
import { useBLEContext } from '../context/BLEContext';
import { useWorkoutSession } from '../hooks/useWorkoutSession';
import { saveSession } from '../lib/storage';
import { RepData } from '../lib/types';

export default function WorkoutScreen() {
  const router = useRouter();
  const { status, lastRep, debugLogs, disconnect } = useBLEContext();
  const {
    session,
    currentSet,
    lastRepDuration,
    startSession,
    addRep,
    endSession,
    reset,
  } = useWorkoutSession();
  const handledRepRef = useRef<RepData | null>(lastRep);

  useEffect(() => {
    startSession();
  }, [startSession]);

  useEffect(() => {
    if (!lastRep || handledRepRef.current === lastRep) return;

    handledRepRef.current = lastRep;
    console.log('[SmartCounter Workout] adding BLE rep to session', lastRep);
    if (!session) startSession();
    addRep(lastRep);
  }, [addRep, lastRep, session, startSession]);

  const handleEnd = async () => {
    endSession();

    const finalizedSets = currentSet
      ? [...(session?.sets ?? []), { ...currentSet, endTime: Date.now() }]
      : session?.sets ?? [];
    const finalSession = session ? { ...session, sets: finalizedSets } : null;

    if (finalSession && finalSession.totalReps > 0) {
      await saveSession(finalSession);
      Alert.alert('Session saved', `${finalSession.totalReps} total reps logged.`, [
        { text: 'Done', onPress: () => router.replace('/') },
      ]);
    } else {
      router.replace('/');
    }

    reset();
    await disconnect();
  };

  const mockRep = () => {
    const rep: RepData = {
      set: currentSet?.setNumber ?? 1,
      rep: (currentSet?.reps.length ?? 0) + 1,
      durationMs: Math.round(1200 + Math.random() * 800),
      timestamp: Date.now(),
    };
    if (!session) startSession();
    addRep(rep);
  };

  const currentReps = currentSet?.reps.length ?? 0;
  const currentSetNum = currentSet?.setNumber ?? 1;
  const completedSets = session?.sets ?? [];
  const chartSets = currentSet ? [...completedSets, currentSet] : completedSets;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.statusRow}>
        <View style={[styles.dot, status === 'connected' ? styles.dotGreen : styles.dotYellow]} />
        <Text style={styles.statusText}>
          {status === 'connected' ? 'ESP32 connected' : 'Mock mode - no hardware'}
        </Text>
      </View>

      <RepCounter reps={currentReps} lastDurationMs={lastRepDuration} />
      <SetTracker currentSet={currentSetNum} totalSets={completedSets.length + 1} />

      <TouchableOpacity style={styles.mockButton} onPress={mockRep}>
        <Text style={styles.mockButtonText}>Mock rep</Text>
      </TouchableOpacity>

      <FatigueChart sets={chartSets} />

      <View style={styles.debugPanel}>
        <Text style={styles.debugTitle}>BLE logs</Text>
        {debugLogs.length === 0 ? (
          <Text style={styles.debugLine}>No BLE packets logged yet.</Text>
        ) : (
          debugLogs.slice(0, 8).map((line, index) => (
            <Text key={`${index}-${line}`} style={styles.debugLine}>
              {line}
            </Text>
          ))
        )}
      </View>

      <TouchableOpacity style={styles.endButton} onPress={handleEnd}>
        <Text style={styles.endButtonText}>End session</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingBottom: 60 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  dotGreen: { backgroundColor: '#4ade80' },
  dotYellow: { backgroundColor: '#facc15' },
  statusText: { color: '#888888', fontSize: 13 },
  mockButton: {
    backgroundColor: '#242424',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333333',
  },
  mockButtonText: { color: '#e8f542', fontSize: 14, fontWeight: '700' },
  debugPanel: {
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginTop: 4,
    marginBottom: 20,
  },
  debugTitle: { color: '#ffffff', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  debugLine: { color: '#9ca3af', fontSize: 11, lineHeight: 16, marginBottom: 5 },
  endButton: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  endButtonText: { color: '#888888', fontSize: 15 },
});
