import { useCallback, useEffect } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FatigueChart } from '../components/FatigueChart';
import { RepCounter } from '../components/RepCounter';
import { SetTracker } from '../components/SetTracker';
import { useBLE } from '../hooks/useBLE';
import { useWorkoutSession } from '../hooks/useWorkoutSession';
import { saveSession } from '../lib/storage';
import { RepData } from '../lib/types';

export default function WorkoutScreen() {
  const router = useRouter();
  const {
    session,
    currentSet,
    lastRepDuration,
    startSession,
    addRep,
    endSession,
    reset,
  } = useWorkoutSession();

  const handleRep = useCallback(
    (rep: RepData) => {
      if (!session) startSession();
      addRep(rep);
    },
    [addRep, session, startSession]
  );

  const { status, disconnect } = useBLE(handleRep);

  useEffect(() => {
    startSession();
  }, [startSession]);

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
    handleRep(rep);
  };

  const currentReps = currentSet?.reps.length ?? 0;
  const currentSetNum = currentSet?.setNumber ?? 1;
  const completedSets = session?.sets ?? [];
  const chartSets = currentSet ? [...completedSets, currentSet] : completedSets;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.statusRow}>
        <View style={[styles.dot, status === 'connected' ? styles.dotGreen : styles.dotRed]} />
        <Text style={styles.statusText}>{status === 'connected' ? 'Connected' : status}</Text>
      </View>

      <RepCounter reps={currentReps} lastDurationMs={lastRepDuration} />
      <SetTracker currentSet={currentSetNum} totalSets={completedSets.length + 1} />

      <TouchableOpacity style={styles.mockButton} onPress={mockRep}>
        <Text style={styles.mockButtonText}>Mock rep</Text>
      </TouchableOpacity>

      <FatigueChart sets={chartSets} />

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
  dotRed: { backgroundColor: '#f87171' },
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
