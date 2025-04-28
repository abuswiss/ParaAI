import React, { useState, useEffect } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai'; // Use correct Jotai hooks
import { activeCaseIdAtom, activeCaseAtom } from '@/atoms/appAtoms'; // Import atoms
// import { useAppStore } from '@/store/appStore'; // Remove Zustand import
import * as caseService from '@/services/caseService';
import { useAuth } from '@/context/AuthContext';

interface CaseSelectorProps {
  showCreateOption?: boolean;
}

const CaseSelector: React.FC<CaseSelectorProps> = ({ showCreateOption = true }) => {
  const { user } = useAuth();
  const [cases, setCases] = useState<caseService.Case[]>([]);
  const [activeCaseId, setActiveCaseId] = useAtom(activeCaseIdAtom); // Get ID and setter
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
        const message = err instanceof Error ? err.message : 'Failed to load cases';
        console.error('Error fetching cases:', message);
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
    setActiveCaseId(selectedCaseId); // Only set the ID atom
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
      <label htmlFor="case-select" className="block text-sm font-medium text-neutral-700 dark:text-text-secondary mb-1">
        Active Case
      </label>
      <select
        id="case-select"
        value={activeCaseId || ''} // Use activeCaseId from atom
        onChange={handleSelectChange}
        className="w-full px-3 py-2 border border-neutral-300 dark:border-surface-lighter rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary bg-white dark:bg-surface text-neutral-900 dark:text-text-primary text-sm disabled:opacity-75"
        disabled={isLoading}
      >
        <option value="">{isLoading ? 'Loading cases...' : '-- Select a Case --'}</option>
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.case_number} - {c.client_name}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-error mt-1">{error}</p>}
    </div>
  );
};

export default CaseSelector; 