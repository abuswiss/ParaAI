import { useAtomValue } from 'jotai';
import { activeCaseIdAtom } from '@/atoms/appAtoms';

/**
 * Custom hook to get the currently active case ID.
 * Returns the case ID (string) or null if no case is active.
 */
export const useActiveCaseId = (): string | null => {
  const activeCaseId = useAtomValue(activeCaseIdAtom);
  return activeCaseId;
}; 