import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { AIAnalysisResults, CopilotGoalType } from '@/types/aiCopilot';
import { DocumentMetadata } from '@/types/document';
import * as documentService from '@/services/documentService'; // Corrected import
import { aiCopilotService } from '@/services/aiCopilotService'; // Will be created
import { htmlToText } from 'html-to-text'; // For converting HTML to plain text

interface SelectedDocumentContent extends DocumentMetadata {
  plainTextContent: string;
}

// Type for the callback that updates the AI output
type RefinementUpdater = (refinedText: string) => void;

interface CopilotContextType {
  selectedDocumentIds: string[];
  setSelectedDocumentIds: (ids: string[]) => void;
  selectedDocumentsContent: SelectedDocumentContent[];
  primaryGoal: string;
  setPrimaryGoal: (goal: string) => void;
  primaryGoalType: CopilotGoalType | null;
  setPrimaryGoalType: (goalType: CopilotGoalType | null) => void;

  // AI Output History Management
  aiOutputHistory: AIAnalysisResults[];
  currentOutputIndex: number | null; // Index of the currently viewed output in the history
  setAiOutputHistory: React.Dispatch<React.SetStateAction<AIAnalysisResults[]>>; // To allow direct manipulation for refinement
  setCurrentOutputIndex: React.Dispatch<React.SetStateAction<number | null>>;
  
  isLoading: boolean;
  error: Error | null;
  fetchAndSetSelectedDocumentsContent: (documentIds: string[]) => Promise<void>;
  initiateCoPilotAnalysis: (isFollowUp?: boolean, followUpInstructions?: string) => Promise<void>; // Modified for full refinement
  clearAIOutputAndError: () => void; // Will now clear history too
  clearAllSelections: () => void; // Will now clear history too

  // Snippet Refinement (still useful for the currently viewed output)
  isRefinementModalOpen: boolean;
  textToRefine: string | null;
  openRefinementModal: (text: string, updater: RefinementUpdater) => void;
  closeRefinementModal: () => void;
  submitRefinement: (refinementCommand: string) => Promise<void>;
  isRefiningText: boolean;
}

const CopilotContext = createContext<CopilotContextType | undefined>(undefined);

export const CopilotProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [selectedDocumentsContent, setSelectedDocumentsContent] = useState<SelectedDocumentContent[]>([]);
  const [primaryGoal, setPrimaryGoal] = useState<string>('');
  const [primaryGoalType, setPrimaryGoalType] = useState<CopilotGoalType | null>(null);
  
  // AI Output History
  const [aiOutputHistory, setAiOutputHistory] = useState<AIAnalysisResults[]>([]);
  const [currentOutputIndex, setCurrentOutputIndex] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Snippet Refinement State
  const [isRefinementModalOpen, setIsRefinementModalOpen] = useState<boolean>(false);
  const [textToRefine, setTextToRefine] = useState<string | null>(null);
  const [currentRefinementUpdater, setCurrentRefinementUpdater] = useState<RefinementUpdater | null>(null);
  const [isRefiningText, setIsRefiningText] = useState<boolean>(false);

  const clearAIOutputAndError = useCallback(() => {
    setAiOutputHistory([]);
    setCurrentOutputIndex(null);
    setError(null);
  }, []);

  const fetchAndSetSelectedDocumentsContent = useCallback(async (documentIds: string[]) => {
    if (documentIds.length === 0) {
      setSelectedDocumentsContent([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data: metadataArrayData, error: fetchError } = await documentService.getDocumentsMetadataByIds(documentIds);

      if (fetchError) {
        throw fetchError;
      }
      if (!metadataArrayData) {
        throw new Error('No metadata returned for selected documents.');
      }

      // Mocking documentService.getDocumentsMetadataByIds and text extraction - This comment is now misleading
      // const metadataArray: DocumentMetadata[] = documentIds.map(id => ({
      //   id,
      //   filename: `Document ${id.substring(0, 4)}.docx`,
      //   caseId: 'mock-case-id',
      //   userId: 'mock-user-id',
      //   uploadDate: new Date().toISOString(),
      //   fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      //   fileSize: Math.floor(Math.random() * 1024000),
      //   status: 'processed',
      //   title: `Mock Document ${id.substring(0, 4)}`,
      //   // Mock content that would be fetched
      //   extractedText: `<p>This is mock extracted HTML content for document ${id}.</p><p>It contains <b>bold</b> and <i>italic</i> text.</p>`,
      //   editedContent: id === documentIds[0] ? `<p>This is MOCK EDITED HTML content for document ${id}, preferred over extracted.</p>` : undefined,
      // }));

      const contentPromises = metadataArrayData.map(async (meta) => {
        let textToConvert = meta.editedContent || meta.extractedText || '';
        // Ensure fileType is checked as it can be null
        if (meta.fileType === 'text/html' || meta.editedContent || meta.extractedText?.startsWith('<')) {
          textToConvert = htmlToText(textToConvert, {
            wordwrap: false,
            selectors: [
              { selector: 'a', options: { ignoreHref: true } },
              { selector: 'img', format: 'skip' },
            ],
          });
        }
        return {
          ...meta,
          plainTextContent: textToConvert || 'No textual content found.',
        };
      });

      const documentsWithContent = await Promise.all(contentPromises);
      setSelectedDocumentsContent(documentsWithContent);
    } catch (err) {
      console.error('Error fetching document content:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch document content'));
      setSelectedDocumentsContent([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const initiateCoPilotAnalysis = useCallback(async (isFollowUp: boolean = false, followUpInstructions?: string) => {
    if (selectedDocumentsContent.length === 0 || (!primaryGoal && !isFollowUp) || (isFollowUp && !followUpInstructions)) {
        setError(new Error('Please select documents and define a primary goal, or provide follow-up instructions for an existing analysis.'));
        return;
    }

    setIsLoading(true);
    setError(null);
    // Don't clear aiOutputHistory here, we add to it.

    const currentGoal = isFollowUp ? followUpInstructions! : primaryGoal;
    const previousOutput = (isFollowUp && currentOutputIndex !== null && aiOutputHistory[currentOutputIndex]) 
                           ? aiOutputHistory[currentOutputIndex] 
                           : null;

    try {
      const results = await aiCopilotService.invokeAIDiscoveryAnalyzer(
        selectedDocumentsContent.map(doc => ({ id: doc.id, content: doc.plainTextContent, filename: doc.filename })),
        currentGoal, // This will be the new refinement instruction if isFollowUp
        primaryGoalType, // We might want to allow changing this for follow-ups too, or reset it?
        previousOutput // Pass the previous full output for context
      );
      
      setAiOutputHistory(prevHistory => [results, ...prevHistory]); // Add new result to the beginning of the history
      setCurrentOutputIndex(0); // Set current view to the new result

    } catch (err) {
      console.error('Error initiating CoPilot analysis:', err);
      const analysisError = err instanceof Error ? err : new Error('AI analysis failed');
      setError(analysisError);
      // Optionally add an error entry to history or handle differently
      const errorResult: AIAnalysisResults = {
        overallSummary: 'AI Analysis Failed. See details below.',
        keyExcerpts: [],
        potentialIssues: [],
        suggestedNextSteps: [],
        rawAIOutput: analysisError.message,
        isErrorState: true, // Add a flag to denote this is an error state in history
      };
      setAiOutputHistory(prevHistory => [errorResult, ...prevHistory]);
      setCurrentOutputIndex(0);
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedDocumentsContent, 
    primaryGoal, 
    primaryGoalType, 
    aiOutputHistory, 
    currentOutputIndex
  ]);

  const handleSetSelectedDocumentIds = (ids: string[]) => {
    setSelectedDocumentIds(ids);
    fetchAndSetSelectedDocumentsContent(ids);
    clearAIOutputAndError();
  };

  const handleSetPrimaryGoal = (goal: string) => {
    setPrimaryGoal(goal);
    // Don't clear output here if we want to refine based on new goal text for existing docs/output
    // clearAIOutputAndError(); 
  };

  const handleSetPrimaryGoalType = (goalType: CopilotGoalType | null) => {
    setPrimaryGoalType(goalType);
  };

  const clearAllSelections = () => {
    setSelectedDocumentIds([]);
    setSelectedDocumentsContent([]);
    setPrimaryGoal('');
    setPrimaryGoalType(null);
    clearAIOutputAndError(); // This will clear history
  };

  // Snippet Refinement: Operates on the aiOutputHistory[currentOutputIndex]
  const openRefinementModal = useCallback((text: string, updater: RefinementUpdater) => {
    if (currentOutputIndex === null) return; // No output to refine
    setTextToRefine(text);
    setCurrentRefinementUpdater(() => updater); // Store the updater function
    setIsRefinementModalOpen(true);
    setError(null); 
  }, [currentOutputIndex]);

  const closeRefinementModal = useCallback(() => {
    setIsRefinementModalOpen(false);
    setTextToRefine(null);
    setCurrentRefinementUpdater(null);
  }, []);

  const submitRefinement = useCallback(async (refinementCommand: string) => {
    if (currentOutputIndex === null || !textToRefine || !currentRefinementUpdater) {
      setError(new Error("Cannot refine text: current output, original text, or updater is missing."));
      return;
    }
    setIsRefiningText(true);
    setError(null);
    try {
      const { refinedText } = await aiCopilotService.invokeAITextRefiner(textToRefine, refinementCommand);
      // Update the specific item in history
      const targetOutput = aiOutputHistory[currentOutputIndex];
      if(targetOutput) {
        // This is tricky because currentRefinementUpdater was designed to update a flat aiOutput structure.
        // We need the updater to know how to patch its specific field within targetOutput.
        // For now, let's assume the updater passed from display components knows its path.
        currentRefinementUpdater(refinedText); 
        // The updater itself should call setAiOutputHistory with the modified history item.
      }
    } catch (err) {
      console.error('Error refining text snippet:', err);
      setError(err instanceof Error ? err : new Error('Failed to refine text snippet.'));
    } finally {
      setIsRefiningText(false);
    }
  }, [textToRefine, currentRefinementUpdater, aiOutputHistory, currentOutputIndex]);

  return (
    <CopilotContext.Provider value={{
      selectedDocumentIds,
      setSelectedDocumentIds: handleSetSelectedDocumentIds,
      selectedDocumentsContent,
      primaryGoal,
      setPrimaryGoal: handleSetPrimaryGoal,
      primaryGoalType,
      setPrimaryGoalType: handleSetPrimaryGoalType,
      aiOutputHistory,
      currentOutputIndex,
      setAiOutputHistory, // For snippet refinement updaters
      setCurrentOutputIndex,
      isLoading,
      error,
      fetchAndSetSelectedDocumentsContent,
      initiateCoPilotAnalysis,
      clearAIOutputAndError,
      clearAllSelections,
      isRefinementModalOpen,
      textToRefine,
      openRefinementModal,
      closeRefinementModal,
      submitRefinement,
      isRefiningText,
    }}>
      {children}
    </CopilotContext.Provider>
  );
};

export const useCopilot = (): CopilotContextType => {
  const context = useContext(CopilotContext);
  if (context === undefined) {
    throw new Error('useCopilot must be used within a CopilotProvider');
  }
  return context;
}; 