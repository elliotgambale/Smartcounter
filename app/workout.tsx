import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FatigueChart } from '../components/FatigueChart';
import { RepCounter } from '../components/RepCounter';
import { SetTracker } from '../components/SetTracker';
import { useBLEContext } from '../context/BLEContext';
import { useWorkoutSession } from '../hooks/useWorkoutSession';
import { saveSession } from '../lib/storage';
import { RepData } from '../lib/types';

const WORKOUTS = ['Pushups', 'Pullups', 'Squats', 'Situps', 'Curls', 'Shoulder Press'];

interface CompletedWorkoutSummary {
  workoutName: string;
  sets: number;
  reps: number;
}

export default function WorkoutScreen() {
  const router = useRouter();
  const { status, lastRep, debugLogs, disconnect } = useBLEContext();
  const [selectedWorkout, setSelectedWorkout] = useState<string | null>(null);
  const [currentWorkoutSummary, setCurrentWorkoutSummary] =
    useState<CompletedWorkoutSummary | null>(null);
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

  const handleSelectWorkout = (workoutName: string) => {
    setSelectedWorkout(workoutName);
    setCurrentWorkoutSummary(null);
    startSession(workoutName);
  };

  useEffect(() => {
    if (!selectedWorkout || !lastRep || handledRepRef.current === lastRep) return;

    handledRepRef.current = lastRep;
    console.log('[SmartCounter Workout] adding BLE rep to session', lastRep);
    if (!session) startSession(selectedWorkout);
    addRep(lastRep);
  }, [addRep, lastRep, selectedWorkout, session, startSession]);

  const handleEnd = async () => {
    endSession();

    const finalizedSets = currentSet
      ? [...(session?.sets ?? []), { ...currentSet, endTime: Date.now() }]
      : session?.sets ?? [];
    const finalSession = session ? { ...session, sets: finalizedSets } : null;

    if (finalSession && finalSession.totalReps > 0) {
      await saveSession(finalSession);
      setCurrentWorkoutSummary({
        workoutName: finalSession.workoutName,
        sets: finalSession.sets.length,
        reps: finalSession.totalReps,
      });
    }

    reset();
    handledRepRef.current = lastRep;
    setSelectedWorkout(null);
  };

  const handleBackToChooser = () => {
    reset();
    handledRepRef.current = lastRep;
    setSelectedWorkout(null);
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
          {status === 'connected' ? 'ESP32 connected' : 'Device not connected'}
        </Text>
      </View>

      <View style={styles.currentWorkoutPanel}>
        <Text style={styles.sectionLabel}>Current workout</Text>
        {selectedWorkout ? (
          <>
            <Text style={styles.currentWorkoutTitle}>{selectedWorkout}</Text>
            <Text style={styles.currentWorkoutMeta}>
              {completedSets.length + (currentSet ? 1 : 0)} set
              {completedSets.length + (currentSet ? 1 : 0) === 1 ? '' : 's'} | {session?.totalReps ?? 0} reps
            </Text>
          </>
        ) : currentWorkoutSummary ? (
          <>
            <Text style={styles.currentWorkoutTitle}>{currentWorkoutSummary.workoutName}</Text>
            <Text style={styles.currentWorkoutMeta}>
              Saved {currentWorkoutSummary.sets} set
              {currentWorkoutSummary.sets === 1 ? '' : 's'} | {currentWorkoutSummary.reps} reps
            </Text>
          </>
        ) : (
          <Text style={styles.currentWorkoutMeta}>Choose a workout to start recording reps.</Text>
        )}
      </View>

      {!selectedWorkout ? (
        <View style={styles.selector}>
          <Text style={styles.selectorTitle}>Choose workout</Text>
          <Text style={styles.selectorSubtitle}>Reps and sets will be saved under this workout.</Text>
          <View style={styles.workoutGrid}>
            {WORKOUTS.map((workoutName) => (
              <TouchableOpacity
                key={workoutName}
                style={styles.workoutButton}
                onPress={() => handleSelectWorkout(workoutName)}
              >
                <Text style={styles.workoutButtonText}>{workoutName}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.workoutName}>{selectedWorkout}</Text>
          <RepCounter reps={currentReps} lastDurationMs={lastRepDuration} />
          <SetTracker currentSet={currentSetNum} totalSets={completedSets.length + 1} />
        </>
      )}

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

      {selectedWorkout ? (
        <>
          <TouchableOpacity style={styles.endButton} onPress={handleEnd}>
            <Text style={styles.endButtonText}>Finish and save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={handleBackToChooser}>
            <Text style={styles.backButtonText}>Back to workouts</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity style={styles.historyButton} onPress={() => router.push('/history')}>
          <Text style={styles.historyButtonText}>View history</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.disconnectButton} onPress={disconnect}>
        <Text style={styles.disconnectButtonText}>Disconnect device</Text>
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
  currentWorkoutPanel: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  sectionLabel: { color: '#555555', fontSize: 11, letterSpacing: 2, marginBottom: 8 },
  currentWorkoutTitle: { color: '#ffffff', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  currentWorkoutMeta: { color: '#888888', fontSize: 14 },
  selector: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#222222',
  },
  selectorTitle: { color: '#ffffff', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  selectorSubtitle: { color: '#888888', fontSize: 13, marginBottom: 16 },
  workoutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  workoutButton: {
    backgroundColor: '#242424',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  workoutButtonText: { color: '#e8f542', fontSize: 14, fontWeight: '700' },
  workoutName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 10,
  },
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
    backgroundColor: '#e8f542',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  endButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '800' },
  historyButton: {
    marginTop: 20,
    backgroundColor: '#242424',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  historyButtonText: { color: '#e8f542', fontSize: 15, fontWeight: '700' },
  backButton: {
    marginTop: 12,
    backgroundColor: '#242424',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  backButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  disconnectButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  disconnectButtonText: { color: '#888888', fontSize: 15 },
});
