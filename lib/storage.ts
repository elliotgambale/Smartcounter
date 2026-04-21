import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutSession } from './types';

const SESSIONS_KEY = 'workout_sessions';

export async function saveSession(session: WorkoutSession): Promise<void> {
  const existing = await getSessions();
  const updated = [session, ...existing];
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
}

export async function getSessions(): Promise<WorkoutSession[]> {
  const raw = await AsyncStorage.getItem(SESSIONS_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as WorkoutSession[];
}

export async function clearSessions(): Promise<void> {
  await AsyncStorage.removeItem(SESSIONS_KEY);
}
