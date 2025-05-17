import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAtomValue } from 'jotai'; // Import useAtomValue
import { Case } from '@/types/case';
import { activeCaseIdAtom } from '@/atoms/appAtoms'; // Import the global activeCaseIdAtom
import { getCaseById } from '@/services/caseService'; // Import case fetching service

interface CaseContextType {
  activeCase: Case | null;
  setActiveCase: (caseData: Case | null) => void; // Keep this for potential direct setting, though primarily driven by Jotai now
  isLoadingCase: boolean; // Add loading state
}

const CaseContext = createContext<CaseContextType | undefined>(undefined);

export const CaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeCase, setActiveCase] = useState<Case | null>(null);
  const [isLoadingCase, setIsLoadingCase] = useState<boolean>(false);
  const globalActiveCaseId = useAtomValue(activeCaseIdAtom); // Subscribe to Jotai atom

  useEffect(() => {
    const fetchAndUpdateActiveCase = async (caseId: string) => {
      setIsLoadingCase(true);
      setActiveCase(null); // Clear previous case while loading new one
      try {
        // console.log(`CaseContext: globalActiveCaseId changed to ${caseId}, fetching details...`);
        const { data, error } = await getCaseById(caseId);
        if (error) {
          console.error('CaseContext: Error fetching case details:', error);
          setActiveCase(null);
        } else {
          // console.log('CaseContext: Case details fetched:', data);
          setActiveCase(data);
        }
      } catch (error) {
        console.error('CaseContext: Exception fetching case details:', error);
        setActiveCase(null);
      } finally {
        setIsLoadingCase(false);
      }
    };

    if (globalActiveCaseId) {
      fetchAndUpdateActiveCase(globalActiveCaseId);
    } else {
      // console.log('CaseContext: globalActiveCaseId is null, setting context activeCase to null.');
      setActiveCase(null);
      setIsLoadingCase(false);
    }
  }, [globalActiveCaseId]); // Re-run effect when globalActiveCaseId changes

  return (
    <CaseContext.Provider value={{ activeCase, setActiveCase, isLoadingCase }}>
      {children}
    </CaseContext.Provider>
  );
};

export const useCase = (): CaseContextType => {
  const context = useContext(CaseContext);
  if (context === undefined) {
    throw new Error('useCase must be used within a CaseProvider');
  }
  return context;
}; 