import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { FatigueChart } from '../components/FatigueChart';
import { RepCounter } from '../components/RepCounter';
import { SetTracker } from '../components/SetTracker';
import { useBLEContext } from '../context/BLEContext';
import { useWorkoutSession } from '../hooks/useWorkoutSession';
import { getSessions, saveSession } from '../lib/storage';
import { RepData, WorkoutSession } from '../lib/types';

const EXERCISES = ['Pushups', 'Pullups', 'Squats', 'Situps', 'Curls', 'Shoulder Press'];

type ScreenMode = 'create' | 'selectExercise' | 'reps';

export default function WorkoutScreen() {
  const { status, lastRep, debugLogs, disconnect } = useBLEContext();
  const [mode, setMode] = useState<ScreenMode>('create');
  const [workoutName, setWorkoutName] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const {
    session,
    currentSet,
    lastRepDuration,
    startSession,
    startSet,
    addRep,
    finishSet,
    reset,
  } = useWorkoutSession();
  const handledRepRef = useRef<RepData | null>(lastRep);

  const loadRecentSessions = useCallback(async () => {
    const sessions = await getSessions();
    setRecentSessions(sessions.slice(0, 5));
  }, []);

  useEffect(() => {
    loadRecentSessions();
  }, [loadRecentSessions]);

  useEffect(() => {
    if (mode !== 'reps' || !lastRep || handledRepRef.current === lastRep) return;

    handledRepRef.current = lastRep;
    console.log('[SmartCounter Workout] adding BLE rep to set', lastRep);
    addRep(lastRep);
  }, [addRep, lastRep, mode]);

  const handleCreateWorkout = () => {
    const trimmedName = workoutName.trim();
    if (!trimmedName) return;

    startSession(trimmedName);
    setSelectedExercise(null);
    setMode('selectExercise');
  };

  const handleSelectExercise = (exerciseName: string) => {
    setSelectedExercise(exerciseName);
    startSet(exerciseName);
    handledRepRef.current = lastRep;
    setMode('reps');
  };

  const buildFinalSession = () => {
    if (!session) return null;

    const finalizedSets =
      currentSet && currentSet.reps.length > 0
        ? [...session.sets, { ...currentSet, endTime: Date.now() }]
        : session.sets;

    return { ...session, sets: finalizedSets };
  };

  const handleFinishSet = () => {
    finishSet();
    handledRepRef.current = lastRep;
  };

  const handleBackToExerciseSelection = () => {
    setSelectedExercise(null);
    setMode('selectExercise');
  };

  const handleFinishWorkout = async () => {
    const finalSession = buildFinalSession();

    if (finalSession && finalSession.totalReps > 0) {
      await saveSession(finalSession);
    }

    reset();
    setSelectedExercise(null);
    setWorkoutName('');
    setMode('create');
    handledRepRef.current = lastRep;
    await loadRecentSessions();
  };

  const currentReps = currentSet?.reps.length ?? 0;
  const completedSets = session?.sets ?? [];
  const currentSetNum = currentSet?.setNumber ?? completedSets.length + 1;
  const chartSets = currentSet ? [...completedSets, currentSet] : completedSets;
  const canCreateWorkout = workoutName.trim().length > 0;

  return (
    <View style={styles.container}>
      {mode === 'reps' ? (
        <View style={styles.repHeader}>
          <TouchableOpacity style={styles.headerButton} onPress={handleBackToExerciseSelection}>
            <Text style={styles.headerButtonText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.finishSetButton} onPress={handleFinishSet}>
            <Text style={styles.finishSetButtonText}>Finish set</Text>
          </TouchableOpacity>
          <View style={styles.headerSpacer} />
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, mode === 'reps' && styles.repContent]}
      >
        <View style={styles.statusRow}>
          <View style={[styles.dot, status === 'connected' ? styles.dotGreen : styles.dotYellow]} />
          <Text style={styles.statusText}>
            {status === 'connected' ? 'ESP32 connected' : 'Device not connected'}
          </Text>
        </View>

        {mode === 'create' ? (
          <>
            <View style={styles.panel}>
              <Text style={styles.sectionLabel}>Create workout</Text>
              <Text style={styles.title}>Name your workout</Text>
              <TextInput
                value={workoutName}
                onChangeText={setWorkoutName}
                placeholder="Morning lift"
                placeholderTextColor="#555555"
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={handleCreateWorkout}
              />
              <TouchableOpacity
                style={[styles.primaryButton, !canCreateWorkout && styles.disabledButton]}
                onPress={handleCreateWorkout}
                disabled={!canCreateWorkout}
              >
                <Text style={styles.primaryButtonText}>Create workout</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.panel}>
              <Text style={styles.sectionLabel}>Recent workouts</Text>
              {recentSessions.length === 0 ? (
                <Text style={styles.emptyText}>No completed workouts yet.</Text>
              ) : (
                recentSessions.map((item) => (
                  <View key={item.id} style={styles.historyCard}>
                    <Text style={styles.historyWorkoutName}>{item.workoutName}</Text>
                    <Text style={styles.historyMeta}>
                      {item.sets.length} sets | {item.totalReps} reps
                    </Text>
                    {item.sets.map((set) => (
                      <Text key={`${item.id}-${set.setNumber}`} style={styles.historySet}>
                        Set {set.setNumber}: {set.exerciseName} | {set.reps.length} reps
                      </Text>
                    ))}
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}

        {mode === 'selectExercise' ? (
          <>
            <View style={styles.panel}>
              <Text style={styles.sectionLabel}>Current workout</Text>
              <Text style={styles.title}>{session?.workoutName}</Text>
              <Text style={styles.meta}>
                {completedSets.length} saved set{completedSets.length === 1 ? '' : 's'} |{' '}
                {session?.totalReps ?? 0} reps
              </Text>
            </View>

            <View style={styles.panel}>
              <Text style={styles.sectionLabel}>Select exercise</Text>
              <View style={styles.exerciseGrid}>
                {EXERCISES.map((exerciseName) => (
                  <TouchableOpacity
                    key={exerciseName}
                    style={styles.exerciseButton}
                    onPress={() => handleSelectExercise(exerciseName)}
                  >
                    <Text style={styles.exerciseButtonText}>{exerciseName}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {completedSets.length > 0 ? (
              <View style={styles.panel}>
                <Text style={styles.sectionLabel}>Saved sets</Text>
                {completedSets.map((set) => (
                  <Text key={set.setNumber} style={styles.savedSetText}>
                    Set {set.setNumber}: {set.exerciseName} | {set.reps.length} reps
                  </Text>
                ))}
              </View>
            ) : null}

            <TouchableOpacity style={styles.primaryButton} onPress={handleFinishWorkout}>
              <Text style={styles.primaryButtonText}>Finish workout</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {mode === 'reps' ? (
          <>
            <View style={styles.repTitleBlock}>
              <Text style={styles.sectionLabel}>Current exercise</Text>
              <Text style={styles.repTitle}>{selectedExercise}</Text>
              <Text style={styles.meta}>{session?.workoutName}</Text>
            </View>
            <RepCounter reps={currentReps} lastDurationMs={lastRepDuration} />
            <SetTracker currentSet={currentSetNum} totalSets={completedSets.length + 1} />
            <FatigueChart sets={chartSets} />
          </>
        ) : null}

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

        <TouchableOpacity style={styles.disconnectButton} onPress={disconnect}>
          <Text style={styles.disconnectButtonText}>Disconnect device</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 60 },
  repContent: { paddingTop: 88 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  dotGreen: { backgroundColor: '#4ade80' },
  dotYellow: { backgroundColor: '#facc15' },
  statusText: { color: '#888888', fontSize: 13 },
  panel: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#222222',
  },
  sectionLabel: { color: '#555555', fontSize: 11, letterSpacing: 2, marginBottom: 8 },
  title: { color: '#ffffff', fontSize: 22, fontWeight: '800', marginBottom: 8 },
  meta: { color: '#888888', fontSize: 14 },
  input: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 10,
    color: '#ffffff',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 14,
  },
  primaryButton: {
    backgroundColor: '#e8f542',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 18,
  },
  disabledButton: { opacity: 0.45 },
  primaryButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '800' },
  emptyText: { color: '#888888', fontSize: 14 },
  historyCard: {
    borderTopWidth: 1,
    borderTopColor: '#262626',
    paddingTop: 12,
    marginTop: 12,
  },
  historyWorkoutName: { color: '#ffffff', fontSize: 16, fontWeight: '800', marginBottom: 4 },
  historyMeta: { color: '#888888', fontSize: 13, marginBottom: 8 },
  historySet: { color: '#c7c7c7', fontSize: 13, lineHeight: 20 },
  exerciseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  exerciseButton: {
    backgroundColor: '#242424',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  exerciseButtonText: { color: '#e8f542', fontSize: 14, fontWeight: '700' },
  savedSetText: { color: '#c7c7c7', fontSize: 14, lineHeight: 22 },
  repHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  headerButton: {
    width: 82,
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  headerButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  finishSetButton: {
    backgroundColor: '#e8f542',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 11,
    alignItems: 'center',
  },
  finishSetButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '800' },
  headerSpacer: { width: 82 },
  repTitleBlock: { alignItems: 'center', marginBottom: 4 },
  repTitle: { color: '#ffffff', fontSize: 22, fontWeight: '800', marginBottom: 4 },
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
