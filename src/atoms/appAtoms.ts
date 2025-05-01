import { atom } from 'jotai';
import { Case, getCaseById } from '@/services/caseService';
import { DocumentMetadata } from '@/services/documentService';
import { getUserCases } from '@/services/caseService';
import { EditorState } from '@/types/editor'

// Define type for the item being viewed/edited in the main panel
export type ActiveEditorItem = { type: 'document' | 'draft'; id: string } | null;

// --- Core State Atoms ---

// Atom for the active case ID. This is the primary atom other case-related atoms derive from.
export const activeCaseIdAtom = atom<string | null>(null);

// Atom for the active item being edited (document or draft).
export const activeEditorItemAtom = atom<EditorState | null>(null);

// --- NEW Derived Atom for Active Document ID (for Chat context) ---
// Reads from activeEditorItemAtom and returns the ID if it's a document
export const activeDocumentContextIdAtom = atom<string | null>(
    (get) => {
        const item = get(activeEditorItemAtom);
        return (item?.type === 'document' && item?.id) ? item.id : null;
    }
);

// Atom for holding text selected in the editor, intended to be sent to the chat query.
export const editorTextToQueryAtom = atom<string | null>(null);

// Atom to track the ID of a newly created blank draft that hasn't been saved yet.
export const newlyCreatedDraftIdAtom = atom<string | null>(null);

// --- NEW Atom to share current case documents (set by FileManager) ---
export const currentCaseDocumentsAtom = atom<DocumentMetadata[]>([]);

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
 * Document fetching is now handled within FileManager.
 */
export const activeCaseAtom = atom(
  (get) => {
    return {
      id: get(activeCaseIdAtom),
      details: get(activeCaseDetailsAtom),
      // Remove document status
    }
  },
  (get, set, caseId: string | null) => {
    // 1. Set the primary ID atom
    set(activeCaseIdAtom, caseId);
    // 2. Trigger the detail fetch 
    set(loadCaseDetailsAtom, caseId);
    // 3. *** REMOVE Triggering document list fetch ***
    // set(loadCaseDocumentsAtom, caseId);
  }
);

// Atom to control the visibility of the Upload Modal
export const uploadModalOpenAtom = atom<boolean>(false);

// Atom to trigger a reset/clear action in the ChatInterface
export const resetChatTriggerAtom = atom(0); // Increment value to trigger 

// --- NEW Atoms for Collapsible Nav and Editor Sidebar --- 

export const isNavCollapsedAtom = atom(false);

// Track if an editor (template or document) is the primary active view
export type EditorType = 'template' | 'document';
export const activeEditorTypeAtom = atom<EditorType | null>(null);

// State for template editor to store its current variables for the sidebar
// export const templateEditorVariablesAtom = atom<string[]>([]); // REMOVE

// --- NEW Atom for AI Draft Modal Context --- 
export type AIDraftContextType = 'document' | 'general' | 'template' | null;
export const aiDraftContextAtom = atom<AIDraftContextType>('general'); // Default to general? 

// --- REMOVE Atoms for Template Editor Actions --- 
/*
// Atom to trigger deletion. Set with the name of the variable to delete.
export const deleteTemplateVariableActionAtom = atom<string | null>(null); 

// Atom to trigger renaming. Set with an object containing old and new names.
export const renameTemplateVariableActionAtom = atom<{ oldName: string; newName: string } | null>(null);
*/

// --- REMOVE Atom for Create Variable Modal --- 
// export const createVariableModalOpenAtom = atom<boolean>(false);

// --- NEW: Atom for Select Template Modal --- 
export const selectTemplateModalOpenAtom = atom<boolean>(false);

// --- NEW: Atom to trigger Fill Template Modal --- 
// Set with the data needed by FillTemplateModal
export const fillTemplateModalTriggerAtom = atom<{ id: string; name: string; content: string } | null>(null);

// --- NEW: Atom for AI Template Draft Modal ---
export const newAITemplateDraftModalOpenAtom = atom<boolean>(false);

// Atom for managing the command palette visibility
export const commandPaletteOpenAtom = atom(false);

// --- NEW: Atom for Template Import Modal ---
export const templateImportModalOpenAtom = atom<boolean>(false);

// --- Background Task Management ---
export type TaskStatus = 'pending' | 'running' | 'success' | 'error';

export interface BackgroundTask {
  id: string; // Unique identifier (e.g., document ID + task type, or a UUID)
  description: string; // User-friendly description (e.g., "Uploading report.pdf", "Analyzing Contract A")
  status: TaskStatus;
  progress?: number; // Optional progress (0-100)
  createdAt: number; // Timestamp for sorting or auto-clearing
}

export const backgroundTasksAtom = atom<BackgroundTask[]>([]);

// Helper atoms/functions to manage tasks (optional but helpful)
export const addTaskAtom = atom(null, (get, set, task: Omit<BackgroundTask, 'createdAt'>) => {
  const newTask = { ...task, createdAt: Date.now() };
  set(backgroundTasksAtom, (prev) => [...prev, newTask]);
});

export const updateTaskAtom = atom(null, (get, set, update: { id: string; status?: TaskStatus; progress?: number; description?: string }) => {
  set(backgroundTasksAtom, (prev) => 
    prev.map(task => 
      task.id === update.id ? { ...task, ...update } : task
    )
  );
});

export const removeTaskAtom = atom(null, (get, set, taskId: string) => {
  set(backgroundTasksAtom, (prev) => prev.filter(task => task.id !== taskId));
});

// Atom to automatically clear completed/failed tasks after a delay
export const clearCompletedTasksAtom = atom(null, (get, set) => {
    const tasks = get(backgroundTasksAtom);
    const now = Date.now();
    const tasksToKeep = tasks.filter(task => {
        // Keep pending/running tasks
        if (task.status === 'pending' || task.status === 'running') return true;
        // Keep success/error tasks for 5 seconds
        const timeElapsed = (now - task.createdAt) / 1000;
        return timeElapsed < 5; 
    });
    // Only update if there's a change to avoid infinite loops
    if (tasksToKeep.length !== tasks.length) {
        set(backgroundTasksAtom, tasksToKeep);
    }
});