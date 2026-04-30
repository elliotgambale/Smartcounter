import { useBLEContext } from '../context/BLEContext';
import { RepData } from '../lib/types';

// Deprecated: BLE state now lives in BLEProvider so it survives navigation.
export function useBLE(_onRepReceived?: (rep: RepData) => void) {
  return useBLEContext();
}
