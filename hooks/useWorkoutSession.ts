import { useCallback, useReducer } from 'react';
import { RepData, WorkoutSession, WorkoutSet } from '../lib/types';

interface SessionState {
  session: WorkoutSession | null;
  currentSet: WorkoutSet | null;
  lastRepDuration: number | null;
}

type Action =
  | { type: 'START_SESSION'; payload: { workoutName: string } }
  | { type: 'ADD_REP'; payload: RepData }
  | { type: 'END_SESSION' }
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
    case 'ADD_REP': {
      const rep = action.payload;
      if (!state.session) return state;

      let completedSets = state.session.sets;
      let currentSet = state.currentSet;

      if (!currentSet || currentSet.setNumber !== rep.set) {
        if (currentSet) {
          completedSets = [...completedSets, { ...currentSet, endTime: Date.now() }];
        }
        currentSet = { setNumber: rep.set, reps: [], startTime: Date.now() };
      }

      currentSet = {
        ...currentSet,
        reps: [...currentSet.reps, rep],
      };

      return {
        ...state,
        currentSet,
        lastRepDuration: rep.durationMs,
        session: {
          ...state.session,
          sets: completedSets,
          totalReps: state.session.totalReps + 1,
        },
      };
    }
    case 'END_SESSION': {
      if (!state.session) return state;

      const sets = state.currentSet
        ? [...state.session.sets, { ...state.currentSet, endTime: Date.now() }]
        : state.session.sets;

      return {
        ...state,
        session: { ...state.session, sets },
        currentSet: null,
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
  const addRep = useCallback((rep: RepData) => dispatch({ type: 'ADD_REP', payload: rep }), []);
  const endSession = useCallback(() => dispatch({ type: 'END_SESSION' }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  return { ...state, startSession, addRep, endSession, reset };
}
