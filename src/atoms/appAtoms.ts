import { atom } from 'jotai';
import { Case, getCaseById } from '@/services/caseService';

// Define type for the item being viewed/edited in the main panel
export type ActiveEditorItem = { type: 'document' | 'draft'; id: string } | null;

// --- Core State Atoms ---

// Atom for the active case ID. This is the primary atom other case-related atoms derive from.
export const activeCaseIdAtom = atom<string | null>(null);

// Atom for the active item being edited (document or draft).
export const activeEditorItemAtom = atom<ActiveEditorItem | null>(null);

// Atom for holding text selected in the editor, intended to be sent to the chat query.
export const editorTextToQueryAtom = atom<string | null>(null);

// --- Derived State Atoms for Case Details ---

// Atom to track the loading state of active case details.
const caseDetailsLoadingAtom = atom<boolean>(false);

// Atom to store any error messages during case detail fetching.
const caseDetailsErrorAtom = atom<string | null>(null);

// Read-only atom for the loading state.
export const isCaseDetailsLoadingAtom = atom((get) => get(caseDetailsLoadingAtom));

// Read-only atom for the error state.
export const caseDetailsFetchErrorAtom = atom((get) => get(caseDetailsErrorAtom));

/*
 * Atom for fetching and storing active case details.
 * This is a derived atom that depends on `activeCaseIdAtom`.
 * When `activeCaseIdAtom` changes, this atom re-evaluates.
 * It uses a read function with async logic to fetch data.
 * IMPORTANT: This fetches data on read. We also need a write function 
 *            (or another atom) to *trigger* the fetch explicitly like Zustand did.
 */
const activeCaseDetailsDataAtom = atom<Case | null>(null);

// This atom represents the *intent* to load case details based on activeCaseId.
// Writing to this atom triggers the fetch.
export const loadCaseDetailsAtom = atom(
  (get) => get(activeCaseDetailsDataAtom), // Read function returns the current data
  async (get, set, caseId: string | null) => {
    if (!caseId) {
      set(activeCaseDetailsDataAtom, null);
      set(caseDetailsLoadingAtom, false);
      set(caseDetailsErrorAtom, null);
      // Also clear the editor item when case is cleared
      set(activeEditorItemAtom, null);
      return;
    }

    // Don't trigger fetch if it's the same ID and we already have data or are loading
    // Note: This basic check might need refinement depending on desired refresh behavior
    if (get(activeCaseIdAtom) === caseId && (get(activeCaseDetailsDataAtom) !== null || get(caseDetailsLoadingAtom))) {
       // console.log("Skipping fetch for same caseId:", caseId); 
       // return; // Decide if refetching same ID should be allowed
    }

    // console.log("Setting loading true for caseId:", caseId);
    set(caseDetailsLoadingAtom, true);
    set(caseDetailsErrorAtom, null);
    set(activeCaseDetailsDataAtom, null); // Clear previous data

    try {
      // console.log("Fetching details for caseId:", caseId);
      const { data, error } = await getCaseById(caseId);
      if (error) {
        throw error;
      }
      // console.log("Fetch successful for caseId:", caseId, data);
      set(activeCaseDetailsDataAtom, data); // Set the fetched data
    } catch (error) {
      console.error("Error fetching case details:", error);
      set(caseDetailsErrorAtom, error instanceof Error ? error.message : 'Failed to load case details');
      set(activeCaseDetailsDataAtom, null); // Ensure data is null on error
    } finally {
      // console.log("Setting loading false for caseId:", caseId);
      set(caseDetailsLoadingAtom, false); // Always set loading to false
    }
  }
);

// Read-only atom to access the fetched case details.
export const activeCaseDetailsAtom = atom((get) => get(activeCaseDetailsDataAtom));

// --- Combined Atom for Setting Active Case ---

/* 
 * This derived atom handles the combined logic of setting the activeCaseId 
 * AND triggering the fetch for its details.
 * Components will primarily interact with this atom to change the active case.
 */
export const activeCaseAtom = atom(
  (get) => {
    // The read part provides the current ID and details (optional, might not be needed)
    return {
      id: get(activeCaseIdAtom),
      details: get(activeCaseDetailsAtom)
    }
  },
  (get, set, caseId: string | null) => {
    // 1. Set the primary ID atom
    set(activeCaseIdAtom, caseId);
    // 2. Trigger the detail fetch by writing the ID to the load atom
    set(loadCaseDetailsAtom, caseId);
  }
); 