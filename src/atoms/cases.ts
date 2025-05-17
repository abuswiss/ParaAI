import { atom } from 'jotai';
import { Case } from '../types';

// Active case ID atom - tracks the currently selected case
export const activeCaseIdAtom = atom<string | null>(null);

// Active case data atom
export interface Case {
  id: string;
  title: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
  case_number?: string;
  client_name?: string;
  created_by: string;
}

export const activeCaseAtom = atom<Case | null>(null);

// Cases list atom
export const casesAtom = atom<Case[]>([]);

// Case loading state
export const casesLoadingAtom = atom<boolean>(true);

// Case error state
export const casesErrorAtom = atom<string | null>(null);

// Atom for managing the state of the "Create New Case" modal
export const isCreateCaseModalOpenAtom = atom(false);

// Atom for storing the list of all cases for the current user
export const allUserCasesAtom = atom<Case[]>([]);
