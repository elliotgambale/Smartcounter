import { useCallback, useReducer } from 'react';
import { RepData, WorkoutSession, WorkoutSet } from '../lib/types';

interface SessionState {
  session: WorkoutSession | null;
  currentSet: WorkoutSet | null;
  lastRepDuration: number | null;
}

type Action =
  | { type: 'START_SESSION'; payload: { workoutName: string } }
  | { type: 'START_SET'; payload: { exerciseName: string } }
  | { type: 'ADD_REP'; payload: RepData }
  | { type: 'FINISH_SET' }
  | { type: 'RESET' };

const initialState: SessionState = {
  session: null,
  currentSet: null,
  lastRepDuration: null,
};

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case 'START_SESSION': {
      const session: WorkoutSession = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString(),
        workoutName: action.payload.workoutName,
        sets: [],
        totalReps: 0,
      };
      return { ...initialState, session };
    }
    case 'START_SET': {
      if (!state.session) return state;

      return {
        ...state,
        currentSet: {
          setNumber: state.session.sets.length + 1,
          exerciseName: action.payload.exerciseName,
          reps: [],
          startTime: Date.now(),
        },
        lastRepDuration: null,
      };
    }
    case 'ADD_REP': {
      const rep = action.payload;
      if (!state.session || !state.currentSet) return state;

      const currentSet = {
        ...state.currentSet,
        reps: [...state.currentSet.reps, rep],
      };

      return {
        ...state,
        currentSet,
        lastRepDuration: rep.durationMs,
        session: {
          ...state.session,
          totalReps: state.session.totalReps + 1,
        },
      };
    }
    case 'FINISH_SET': {
      if (!state.session || !state.currentSet) return state;

      const completedSet = { ...state.currentSet, endTime: Date.now() };
      const sets =
        completedSet.reps.length > 0 ? [...state.session.sets, completedSet] : state.session.sets;

      return {
        ...state,
        session: { ...state.session, sets },
        currentSet: {
          setNumber: sets.length + 1,
          exerciseName: state.currentSet.exerciseName,
          reps: [],
          startTime: Date.now(),
        },
        lastRepDuration: null,
      };
    }
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export function useWorkoutSession() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const startSession = useCallback(
    (workoutName: string) => dispatch({ type: 'START_SESSION', payload: { workoutName } }),
    []
  );
  const startSet = useCallback(
    (exerciseName: string) => dispatch({ type: 'START_SET', payload: { exerciseName } }),
    []
  );
  const addRep = useCallback((rep: RepData) => dispatch({ type: 'ADD_REP', payload: rep }), []);
  const finishSet = useCallback(() => dispatch({ type: 'FINISH_SET' }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  return { ...state, startSession, startSet, addRep, finishSet, reset };
}
