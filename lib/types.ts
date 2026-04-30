export interface RepData {
  set: number;
  rep: number;
  durationMs: number;
  timestamp: number;
}

export interface WorkoutSet {
  setNumber: number;
  reps: RepData[];
  startTime: number;
  endTime?: number;
}

export interface WorkoutSession {
  id: string;
  date: string;
  workoutName: string;
  sets: WorkoutSet[];
  totalReps: number;
}

export type BLEStatus =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';
