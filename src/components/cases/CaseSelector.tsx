import React, { useState, useEffect } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai'; // Use correct Jotai hooks
import { activeCaseIdAtom, activeCaseAtom, activeDocumentContextIdAtom } from '@/atoms/appAtoms'; // Import atoms
// import { useAppStore } from '@/store/appStore'; // Remove Zustand import
import * as caseService from '@/services/caseService';
// import { useAuth } from '@/context/AuthContext';
import { useAuth } from '@/hooks/useAuth';

interface CaseSelectorProps {
  showCreateOption?: boolean;
}

const CaseSelector: React.FC<CaseSelectorProps> = ({ showCreateOption = true }) => {
  const { user } = useAuth();
  const [cases, setCases] = useState<caseService.Case[]>([]);
  const [activeCaseId, setActiveCaseId] = useAtom(activeCaseIdAtom); // Get ID and setter
  const setActiveDocumentContextId = useSetAtom(activeDocumentContextIdAtom);
  const activeCaseData = useAtomValue(activeCaseAtom); // Read derived case data
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    const fetchCases = async () => {
      if (!user) return;

      setIsLoading(true);
      setError(null);
      let fetchedCases: caseService.Case[] = [];
      try {
        const { data, error: fetchError } = await caseService.getUserCases();
        if (fetchError) throw fetchError;
        fetchedCases = data || [];
        setCases(fetchedCases);

        // If no case ID is active, or if the currently active ID doesn't exist in the fetched list,
        // set the first fetched case (if any) as active.
        const currentActiveCaseExists = fetchedCases.some(c => c.id === activeCaseId);
        if ((!activeCaseId || !currentActiveCaseExists) && fetchedCases.length > 0) {
          setActiveCaseId(fetchedCases[0].id); // Only set the ID
        } else if (!currentActiveCaseExists && fetchedCases.length === 0) {
          // No cases fetched, clear active ID if it was set
          setActiveCaseId(null);
        }
        // We don't need to manually set activeCaseData here,
        // as the activeCaseAtom should derive it from activeCaseIdAtom.
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load matters';
        console.error('Error fetching matters:', message);
        setError(message);
        setActiveCaseId(null); // Clear active case ID on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchCases();
    // Only depend on user and the ID setter, as activeCaseData is derived
  }, [user, activeCaseId, setActiveCaseId]);

  const handleCaseSelect = (selectedCaseId: string | null) => {
    setActiveCaseId(selectedCaseId); // Set the selected case ID
    setActiveDocumentContextId(null); // Clear the active document context
    // activeCaseData will update automatically via the derived atom
  };

  const handleCaseCreated = (newCase: caseService.Case) => {
    setCases(prev => [newCase, ...prev]);
    handleCaseSelect(newCase.id); // Set the new ID as active
    setShowCreateDialog(false);
  };

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = event.target.value;
    if (selectedId === '__CREATE_NEW__') {
      setShowCreateDialog(true);
    } else {
      handleCaseSelect(selectedId || null); // Pass string ID or null
    }
  };

  return (
    <div className="case-selector mb-4">
      <label htmlFor="case-select" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground mb-1">
        Active Matter
      </label>
      <select
        id="case-select"
        value={activeCaseId || ''} // Use activeCaseId from atom
        onChange={handleSelectChange}
        className="w-full px-3 py-2 border border-input dark:border-dark-input rounded-md shadow-sm focus:outline-none focus:ring-ring dark:focus:ring-dark-ring focus:border-primary dark:focus:border-dark-primary bg-input dark:bg-dark-input text-foreground dark:text-dark-foreground text-sm disabled:opacity-75"
        disabled={isLoading}
      >
        <option value="">{isLoading ? 'Loading matters...' : '-- Select a Matter --'}</option>
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.case_number || c.name || 'Untitled Matter'} {c.client_name ? `- ${c.client_name}` : ''}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-destructive dark:text-dark-destructive mt-1">{error}</p>}
    </div>
  );
};

export default CaseSelector; 