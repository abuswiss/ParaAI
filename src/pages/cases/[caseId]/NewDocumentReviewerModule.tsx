import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSetAtom, useAtom } from 'jotai';
import {
  activeEditorItemAtom,
  activeCaseIdAtom,
  addTaskAtom,
  updateTaskAtom,
  removeTaskAtom,
  chatPreloadContextAtom,
  chatDocumentContextIdsAtom
} from '../../../atoms/appAtoms'; // Adjusted path based on NewDocumentReviewerModule location
import NewTiptapEditor, { NewTiptapEditorRef } from '../../../components/editor/NewTiptapEditor';
import { getDocumentById, updateDocument, DocumentMetadata } from '../../../services/documentService'; // Adjusted path
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabaseClient'; // Import Supabase client
import { 
  AnalysisType, 
  StructuredAnalysisResult, 
  analyzeDocument as analyzeDocumentServiceCall,
  summarizeTextService, // Import the new service
  SummarizeTextPayload,
  rewriteTextService, // Import the new service
  RewriteTextPayload,
  generateInlineTextService, // Import the new service
  GenerateInlineTextPayload,
  PositionalItem, // Ensured PositionalItem is available from this import block
  type AnalysisType as ServiceAnalysisType
} from '../../../services/documentAnalysisService';
import AnalysisResultRenderer from '../../../components/ai/analysisResultDisplay/AnalysisResultRenderer'; // Removed PositionalItem from here
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Button } from '../../../components/ui/Button';
import SummaryModal from '../../../components/editor/modals/SummaryModal'; // Import the modal
import RewriteSuggestionBar from '../../../components/editor/toolbars/RewriteSuggestionBar'; // Import the suggestion bar
import GeneratePromptModal from '../../../components/editor/modals/GeneratePromptModal'; // Import the modal
import { Sparkles, Save, FileText, FileBarChart2 } from 'lucide-react'; // Removed unused Download

// Analysis options for the dropdown (can be moved to a constants file)
const analysisOptions: { value: AnalysisType; label: string }[] = [
  { value: 'summary', label: 'Summary' },
  { value: 'entities', label: 'Entities' },
  { value: 'clauses', label: 'Key Clauses' },
  { value: 'risks', label: 'Risk Analysis' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'privilegedTerms', label: 'Privileged Terms' },
];

// State for active highlights
interface ActiveHighlight {
  start: number;
  end: number;
  type: 'hover' | 'click'; // To differentiate if needed, or just use different mark attributes
  markAttributes: Record<string, any>; 
}

interface OriginalSelectionRange {
  from: number;
  to: number;
}

// Defined at the top of the component or in a shared constants file
const HOVER_HIGHLIGHT_COLOR = '#FFF9C4'; // A light yellow, e.g., Tailwind bg-yellow-100 or similar hex
const CLICK_HIGHLIGHT_COLOR = '#FFECB3'; // A distinct, perhaps slightly darker yellow, e.g., Tailwind bg-amber-200

const NewDocumentReviewerModule: React.FC = () => {
  const { caseId, id: documentIdFromParams } = useParams<{ caseId?: string; id: string }>(); // Renamed documentId to avoid conflict
  
  const [documentMetadata, setDocumentMetadata] = useState<DocumentMetadata | null>(null);
  const [documentContent, setDocumentContent] = useState<string | object>('');
  const [isEditable, setIsEditable] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // const [activeCaseInfo, setActiveCaseInfo] = useState<Case | null>(null); // If needed for display

  // State for saving
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // State for exports
  const [isExportingWord, setIsExportingWord] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const editorRef = useRef<NewTiptapEditorRef>(null);
  const setActiveEditorItem = useSetAtom(activeEditorItemAtom);
  const [currentActiveCaseId, setCurrentActiveCaseId] = useAtom(activeCaseIdAtom);

  // Task atom setters
  const addTask = useSetAtom(addTaskAtom);
  const updateTask = useSetAtom(updateTaskAtom);
  const removeTask = useSetAtom(removeTaskAtom);
  const setChatPreloadContext = useSetAtom(chatPreloadContextAtom);
  const setChatDocumentContextIds = useSetAtom(chatDocumentContextIdsAtom);

  // State for analysis
  const [selectedAnalysisType, setSelectedAnalysisType] = useState<AnalysisType | null>(null);
  // Cache for analysis results: Key is AnalysisType, Value is StructuredAnalysisResult
  const [analysisResultsCache, setAnalysisResultsCache] = useState<Record<string, StructuredAnalysisResult>>({});
  // State to hold the currently displayed analysis result
  const [displayedAnalysisResult, setDisplayedAnalysisResult] = useState<StructuredAnalysisResult | null>(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  // const [analysisHistory, setAnalysisHistory] = useState<any[]>([]); // For displaying past analyses

  // State for active highlights
  const [activeHoverHighlight, setActiveHoverHighlight] = useState<ActiveHighlight | null>(null);
  const [activeClickHighlight, setActiveClickHighlight] = useState<ActiveHighlight | null>(null);

  // State for Summary Modal
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [summaryContent, setSummaryContent] = useState('');
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  // State for Rewrite Suggestion Bar
  const [isRewriteBarVisible, setIsRewriteBarVisible] = useState(false);
  const [rewriteSuggestion, setRewriteSuggestion] = useState('');
  const [originalSelectionForRewrite, setOriginalSelectionForRewrite] = useState<OriginalSelectionRange | null>(null);
  const [isRewriteLoading, setIsRewriteLoading] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);

  // State for Generate Text (Ask AI) Modal & Streaming
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isGeneratingText, setIsGeneratingText] = useState(false);

  const fetchDocumentData = useCallback(async () => {
    // console.log('[NewDocumentReviewerModule] fetchDocumentData entered. documentIdFromParams value:', documentIdFromParams);
    if (!documentIdFromParams) {
      // console.error('[NewDocumentReviewerModule] fetchDocumentData ERROR: Document ID is missing or falsy.');
      setError('Document ID is missing.');
      setIsLoading(false);
      // console.log('[NewDocumentReviewerModule] fetchDocumentData END - setIsLoading(false) due to missing ID.');
      return;
    }
    
    // console.log('[NewDocumentReviewerModule] fetchDocumentData - Calling setIsLoading(true)');
    setIsLoading(true);
    setError(null);
    setHasUnsavedChanges(false); // Reset on new data load

    try {
      // console.log('[NewDocumentReviewerModule] fetchDocumentData - Calling getDocumentById...');
      const { data: docData, error: docError } = await getDocumentById(documentIdFromParams);
      // console.log('[NewDocumentReviewerModule] fetchDocumentData - getDocumentById returned:', { docData, docError });

      if (docError) {
        // console.error('[NewDocumentReviewerModule] fetchDocumentData ERROR from getDocumentById:', docError);
        throw docError;
      }
      if (!docData) {
        // console.error('[NewDocumentReviewerModule] fetchDocumentData ERROR: No document data returned from getDocumentById.');
        throw new Error('Document not found (no data returned)');
      }
      
      // console.log('[NewDocumentReviewerModule] fetchDocumentData - Document data received:', docData);
      setDocumentMetadata(docData);
      setActiveEditorItem({ type: 'document', id: documentIdFromParams });

      const contentToLoad = docData.editedContent || docData.extractedText || '<p></p>'; 
      // console.log('[NewDocumentReviewerModule] fetchDocumentData - Content to load determined from editedContent/extractedText:', typeof contentToLoad);
      setDocumentContent(contentToLoad);

      const isDraftStatus = docData.processingStatus === 'draft';
      const isUserCreatedType = docData.storagePath === 'ai-generated' || !docData.storagePath;
      
      setIsEditable(isDraftStatus || isUserCreatedType); 
      // console.log('[NewDocumentReviewerModule] fetchDocumentData - isEditable set to:', isDraftStatus || isUserCreatedType, { isDraftStatus, isUserCreatedType });

      if (docData.caseId && docData.caseId !== currentActiveCaseId) {
        // console.log('[NewDocumentReviewerModule] fetchDocumentData - Updating active case ID.');
        setCurrentActiveCaseId(docData.caseId);
      }
    } catch (err: any) {
      // console.error('[NewDocumentReviewerModule] fetchDocumentData CATCH block:', err);
      setError(err.message || 'Failed to load document data.');
      toast.error(err.message || 'Failed to load document data.');
    } finally {
      // console.log('[NewDocumentReviewerModule] fetchDocumentData FINALLY block - Calling setIsLoading(false)');
      setIsLoading(false);
      // console.log('[NewDocumentReviewerModule] fetchDocumentData END - setIsLoading(false) in finally.');
    }
  }, [documentIdFromParams, setActiveEditorItem, currentActiveCaseId, setCurrentActiveCaseId]);

  useEffect(() => {
    // console.log('[NewDocumentReviewerModule] useEffect [documentId, fetchDocumentData] fired. Current documentIdFromParams:', documentIdFromParams);
    if (documentIdFromParams) {
      // console.log('[NewDocumentReviewerModule] useEffect - documentIdFromParams is TRUTHY, calling fetchDocumentData.');
      fetchDocumentData();
    } else {
      // console.warn('[NewDocumentReviewerModule] useEffect - documentIdFromParams is FALSY, NOT calling fetchDocumentData.');
      // If documentIdFromParams is falsy, we should stop loading and show an error.
      setError('Document ID is not available from URL.'); 
      setIsLoading(false); 
    }
  }, [documentIdFromParams, fetchDocumentData]);

  useEffect(() => {
    // If document content is loaded from the server and the editor is ready,
    // explicitly set the content in the editor.
    // This is important if the `content` prop of NewTiptapEditor initializes the editor
    // but doesn't dynamically update it after async data fetching if editor itself caches initial content.
    if (editorRef.current && documentContent && !isLoading) {
      // Check if content is different to avoid unnecessary updates / cursor jumps
      if (typeof documentContent === 'string') {
        const currentEditorHTML = editorRef.current.getHTML();
        if (currentEditorHTML !== documentContent) {
           editorRef.current.setContent(documentContent, false); // Pass false if you don't want to trigger onUpdate during this set
           // Content is being set from fetched data, so it's not "unsaved" from user perspective yet
           setHasUnsavedChanges(false); 
        }
      } else if (typeof documentContent === 'object' && documentContent !== null) {
        // Handle JSON content similarly if necessary
        // This requires editorRef.current.getJSON() and a robust way to compare JSON objects.
        // For simplicity, we might assume that if it's an object, it's Tiptap's JSON format.
        // A deep comparison could be expensive, so consider if this is truly needed
        // or if forcing a setContent is acceptable when content is an object.
        // Example:
        // const currentEditorJSON = editorRef.current.getJSON();
        // if (JSON.stringify(currentEditorJSON) !== JSON.stringify(documentContent)) {
        //   editorRef.current.setContent(documentContent, false);
        // }
        // For now, if it's an object, let's assume it needs to be set if it's different from initial empty state
        // or if the editor's internal representation differs. Often, passing the object directly
        // to Tiptap's setContent handles updates correctly.
        editorRef.current.setContent(documentContent, false); // Re-evaluate if deep comparison is needed
        // Content is being set from fetched data
        setHasUnsavedChanges(false);
      }
    }
  }, [documentContent, isLoading]); 

  useEffect(() => {
    // When selectedAnalysisType changes, try to load from cache
    if (selectedAnalysisType && analysisResultsCache[selectedAnalysisType]) {
      setDisplayedAnalysisResult(analysisResultsCache[selectedAnalysisType]);
      setAnalysisError(null); // Clear any previous error for this type if displaying cached result
      setIsAnalysisLoading(false); // Ensure loading is false if we are showing cached data
    } else if (selectedAnalysisType) {
      // If type selected but no cache, ensure nothing is displayed until "Run Analysis" is clicked
      // and clear any previous analysis error from a different type.
      setDisplayedAnalysisResult(null);
      setAnalysisError(null); 
    } else {
      // No analysis type selected, clear displayed result and error
      setDisplayedAnalysisResult(null);
      setAnalysisError(null);
    }
  }, [selectedAnalysisType, analysisResultsCache]);

  const toggleEditMode = () => {
    if (isEditable && hasUnsavedChanges) {
      // Consider a confirmation modal here if desired: "You have unsaved changes. Switch to view mode anyway?"
      // For now, we'll just allow it but reset the flag.
      // Or, prevent switching until saved. Let's allow it for now.
      setHasUnsavedChanges(false); 
    }
    setIsEditable(!isEditable);
    if (!isEditable && editorRef.current) {
      editorRef.current.focus();
    }
  };

  const handleContentUpdate = () => {
    if (isEditable) { // Only track changes if in edit mode
      setHasUnsavedChanges(true);
    }
  };

  const handleRunAnalysis = async () => {
    if (!selectedAnalysisType || !documentMetadata?.id || !documentMetadata?.extractedText) {
      toast.error('Please select an analysis type and ensure document has text.');
      return;
    }

    // Check cache first before initiating loading state or API call
    if (analysisResultsCache[selectedAnalysisType]) {
      setDisplayedAnalysisResult(analysisResultsCache[selectedAnalysisType]);
      setIsAnalysisLoading(false); // Not loading as it's from cache
      setAnalysisError(null); // Clear any previous errors
      // toast.info(`Loaded cached ${selectedAnalysisType} analysis.`); // Optional: user feedback
      return;
    }

    setIsAnalysisLoading(true);
    setAnalysisError(null);
    setDisplayedAnalysisResult(null); // Clear previous/cached result for other types while loading new one

    try {
      const { data: analysisResultData, error: analysisServiceError, analysisId } = await analyzeDocumentServiceCall({
        documentId: documentMetadata.id,
        analysisType: selectedAnalysisType,
        addTask,
        updateTask,
        removeTask,
      });

      if (analysisServiceError) {
        throw analysisServiceError;
      }

      if (analysisResultData) {
        setAnalysisResultsCache(prevCache => ({
          ...prevCache,
          [selectedAnalysisType]: analysisResultData, // Cache the new result
        }));
        setDisplayedAnalysisResult(analysisResultData); // Display the new result
      } else {
        // This case might indicate an issue with the service or data structure returned
        console.warn("Analysis service returned no data for type:", selectedAnalysisType);
        throw new Error("No analysis data returned from the service.");
      }

      if (analysisId) {
        console.log("Analysis task submitted with ID:", analysisId);
      }
    } catch (e: any) {
      setAnalysisError(e.message || 'Failed to run analysis.');
      toast.error(e.message || 'Failed to run analysis.');
      setDisplayedAnalysisResult(null); // Ensure no stale data is shown on error
    } finally {
      setIsAnalysisLoading(false);
    }
  };

  // Placeholder handlers for AnalysisResultRenderer
  const handleCopyItemText = (text: string, itemName?: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${itemName || 'Text'} copied to clipboard!`);
  };

  const handleAddItemToChatContext = (itemText: string, itemTypeLabel: string) => {
    if (!documentMetadata?.id || !documentMetadata?.extractedText) {
      toast.error("Cannot add to chat: document information is missing.");
      return;
    }
    if (!selectedAnalysisType) {
      toast.error("Cannot add to chat: analysis type not selected.");
      return;
    }

    const currentDocumentId = documentMetadata.id;

    // Ensure the current document is part of the main chat document context
    setChatDocumentContextIds(prevIds => {
      if (!prevIds.includes(currentDocumentId)) {
        return [...prevIds, currentDocumentId];
      }
      return prevIds; // No change needed if ID already exists
    });

    // Set the specific item context for preloading/highlighting in chat input
    setChatPreloadContext({
      analysisItem: itemText, 
      analysisType: selectedAnalysisType, 
      documentText: documentMetadata.extractedText,
    });

    toast.success(`"${itemText.substring(0, 30)}..." and its document added to chat context.`);
    console.log(`Set chatPreloadContext: Type: ${selectedAnalysisType}, Item: ${itemText.substring(0,50)}...`);
    console.log(`Updated chatDocumentContextIds to include: ${currentDocumentId}`);
  };

  const clearEditorHighlight = (highlight: ActiveHighlight | null) => {
    if (editorRef.current && highlight) {
      // Assuming 'highlight' is the markType used by Highlight.configure
      // We might need to be more specific if other highlights are used
      // For now, this will remove any highlight mark in the range.
      editorRef.current.removeMarkFromRange(highlight.start, highlight.end, 'highlight');
      // Or, if we want to remove all highlights of a certain color:
      // editorRef.current.clearMarks('highlight'); // This is too broad if other highlights exist
    }
  };
  
  const handleItemHover = (item: PositionalItem | null) => {
    if (!editorRef.current) return;
    const editorAPI = editorRef.current; // Renamed for clarity, this is NewTiptapEditorRef

    // 1. Clear existing hover highlight
    if (activeHoverHighlight) {
      editorAPI.removeMarkFromRange(activeHoverHighlight.start, activeHoverHighlight.end, 'highlight');
      setActiveHoverHighlight(null);
    }

    if (item && item.start !== undefined && item.end !== undefined) {
      // 2. Do not apply hover highlight if this item is already the active click highlight
      if (
        activeClickHighlight &&
        activeClickHighlight.start === item.start &&
        activeClickHighlight.end === item.end
      ) {
        // Ensure click highlight is still visible (it might have been cleared if hover and click were same item)
        editorAPI.addMarkToRange(activeClickHighlight.start, activeClickHighlight.end, 'highlight', { color: CLICK_HIGHLIGHT_COLOR });
        return; // Don't apply hover styling over an active click highlight
      }

      // 3. Apply new hover highlight
      editorAPI.addMarkToRange(item.start, item.end, 'highlight', { color: HOVER_HIGHLIGHT_COLOR });
      setActiveHoverHighlight({
        start: item.start,
        end: item.end,
        type: 'hover',
        markAttributes: { color: HOVER_HIGHLIGHT_COLOR },
      });
    } 
    // On mouse leave (item is null), the existing hover was already cleared in step 1.
    // Now, ensure the click highlight (if any) is restored, in case it was the same item as hover.
    else if (!item && activeClickHighlight) { 
      editorAPI.addMarkToRange(activeClickHighlight.start, activeClickHighlight.end, 'highlight', { color: activeClickHighlight.markAttributes.color });
    }
  };

  const handleItemClick = (item: PositionalItem) => {
    if (!editorRef.current || item.start === undefined || item.end === undefined) {
      return;
    }
    const editorAPI = editorRef.current; // Renamed for clarity

    // Clear previous click highlight if it exists
    if (activeClickHighlight) {
      editorAPI.removeMarkFromRange(activeClickHighlight.start, activeClickHighlight.end, 'highlight');
    }

    // Clear current hover highlight if it exists, as click takes precedence
    if (activeHoverHighlight) {
      editorAPI.removeMarkFromRange(activeHoverHighlight.start, activeHoverHighlight.end, 'highlight');
      setActiveHoverHighlight(null); // Clear from state
    }

    // Set new click highlight
    editorAPI.addMarkToRange(item.start, item.end, 'highlight', { color: CLICK_HIGHLIGHT_COLOR });
    // editorAPI.focus({ from: item.start, to: item.end }, { scrollIntoView: true }); // Original had editor.commands.scrollIntoView();
    // The focus method on the ref should handle scrolling if the Tiptap focus command does.
    // Let's try to scroll to the start of the item after highlighting.
    editorAPI.scrollToPosition(item.start); 
    
    setActiveClickHighlight({
      start: item.start,
      end: item.end,
      type: 'click',
      markAttributes: { color: CLICK_HIGHLIGHT_COLOR },
    });
  };

  const handleSummarize = useCallback(async () => {
    if (!editorRef.current) {
      toast.error('Editor is not available.');
      return;
    }

    const selection = editorRef.current.getSelectionRange();
    let textToSummarize = '';

    if (!selection.isEmpty) {
      textToSummarize = editorRef.current.getSelectedText();
    } else {
      textToSummarize = editorRef.current.getFullText();
    }

    if (!textToSummarize.trim()) {
      toast.error('No text selected or document is empty to summarize.');
      return;
    }

    setIsSummaryModalOpen(true);
    setIsSummaryLoading(true);
    setSummaryContent('');

    try {
      const payload: SummarizeTextPayload = { textToSummarize, stream: false };
      const response = await summarizeTextService(payload);
      if (response.error) {
        throw new Error(response.error);
      }
      // The summarize-text function was instructed to return HTML (with <strong>), 
      // so we should assign it as is. The modal uses dangerouslySetInnerHTML.
      setSummaryContent(response.result || 'No summary returned.'); 
    } catch (err: any) {
      console.error('Failed to summarize text:', err);
      toast.error(err.message || 'Failed to generate summary.');
      setSummaryContent('Error: Could not generate summary.');
    } finally {
      setIsSummaryLoading(false);
    }
  }, [editorRef]); // editorRef is stable, so this is fine. If other deps, add them.

  const handleRewrite = useCallback(async (mode: RewriteTextPayload['mode'], customInstructions?: string) => {
    if (!editorRef.current) {
      toast.error('Editor is not available.');
      return;
    }

    const selection = editorRef.current.getSelectionRange();
    if (selection.isEmpty) {
      toast.error('Please select text to rewrite.');
      // Optionally, clear/hide rewrite bar if it was visible for a previous selection
      setIsRewriteBarVisible(false); 
      setRewriteSuggestion('');
      setOriginalSelectionForRewrite(null);
      return;
    }

    const textToRewrite = editorRef.current.getSelectedText();
    if (!textToRewrite.trim()) {
      toast.error('Selected text is empty.');
      return;
    }

    setOriginalSelectionForRewrite({ from: selection.from, to: selection.to });
    setIsRewriteBarVisible(true);
    setIsRewriteLoading(true);
    setRewriteSuggestion('');
    setRewriteError(null);

    try {
      const payload: RewriteTextPayload = { 
        textToRewrite, 
        mode, 
        instructions: mode === 'custom' ? customInstructions : undefined, 
        // surroundingContext: editorRef.current.getFullText(), // Could be too much, consider context around selection
        stream: false // Non-streaming for suggestion bar initially
      };
      const response = await rewriteTextService(payload);
      
      if (response.error) {
        throw new Error(response.error);
      }
      setRewriteSuggestion(response.result || 'No suggestion returned.');
    } catch (err: any) {
      console.error('Failed to rewrite text:', err);
      toast.error(err.message || 'Failed to generate rewrite suggestion.');
      setRewriteError(err.message || 'Failed to generate rewrite suggestion.');
      setRewriteSuggestion(''); // Clear suggestion on error
    } finally {
      setIsRewriteLoading(false);
    }
  }, [editorRef]);

  function handleAcceptRewrite() {
    if (!editorRef.current || !editorRef.current.editor || !originalSelectionForRewrite || !rewriteSuggestion) {
      toast.error('Editor is not ready. Please try again.');
      return;
    }

    editorRef.current.focus(null, { scrollIntoView: true }); // Focus editor
    // Replace the original selected text with the suggestion
    const isHtml = /<([A-Za-z][A-Za-z0-9]*)\b[^>]*>(.*?)<\/\1>/.test(rewriteSuggestion);
    const chain = editorRef.current.editor.chain().setTextSelection(originalSelectionForRewrite);
    chain.insertContent(rewriteSuggestion); // Tiptap parses HTML if present
    chain.run();

    setIsRewriteBarVisible(false);
    setRewriteSuggestion('');
    setOriginalSelectionForRewrite(null);
    setRewriteError(null);
    toast.success('Rewrite applied!');
  }

  const handleDeclineRewrite = useCallback(() => {
    setIsRewriteBarVisible(false);
    setRewriteSuggestion('');
    setOriginalSelectionForRewrite(null);
    setRewriteError(null);
  }, []);

  const handleOpenGeneratePrompt = () => {
    if (!editorRef.current) {
      toast.error('Editor is not available.');
      return;
    }
    setIsGenerateModalOpen(true);
  };

  const handleSubmitGeneratePrompt = async (prompt: string) => {
    if (!editorRef.current || !prompt.trim()) {
      toast.error('Editor is not available or prompt is empty.');
      setIsGenerateModalOpen(false);
      return;
    }

    setIsGenerateModalOpen(false);
    setIsGeneratingText(true);
    toast.info('AI is generating text...', { icon: <Sparkles className="h-4 w-4" /> });

    const editor = editorRef.current.editor;
    const currentSelection = editorRef.current.getSelectionRange();
    const selectedText = currentSelection.isEmpty ? undefined : editorRef.current.getSelectedText();
    
    let insertPos = currentSelection.from;
    if (!currentSelection.isEmpty) {
      editor.chain().focus().setTextSelection({ from: currentSelection.from, to: currentSelection.to }).deleteSelection().run();
      // After deleting selection, selection.from is the cursor position
      insertPos = editor.state.selection.from; 
    }
    editor.chain().focus().setTextSelection(insertPos).run(); 

    try {
      const payload: GenerateInlineTextPayload = {
        instructions: prompt,
        selectedText: selectedText,
        surroundingContext: editorRef.current.getFullText().substring(Math.max(0, insertPos - 500), Math.min(editorRef.current.getFullText().length, insertPos + 500)),
      };

      const { reader, error } = await generateInlineTextService(payload);

      if (error || !reader) {
        throw new Error(error || 'Failed to start AI text generation stream.');
      }

      const decoder = new TextDecoder();
      let reading = true;
      let currentStreamInsertPosition = insertPos;

      while (reading) {
        const { done, value } = await reader.read();
        if (done) {
          reading = false;
          break;
        }
        const chunkString = decoder.decode(value);
        const lines = chunkString.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonData = line.substring(6);
            if (jsonData.trim() === '[DONE]') {
              reading = false;
              break;
            }
            try {
              const contentChunk = JSON.parse(jsonData) as string;
              if (contentChunk) {
                editor.chain().insertContentAt(currentStreamInsertPosition, contentChunk).run();
                currentStreamInsertPosition += contentChunk.length;
                editor.chain().focus().setTextSelection(currentStreamInsertPosition).run(); 
              }
            } catch (parseErr) {
              console.warn('AI Generation: Could not parse JSON chunk:', jsonData, parseErr);
            }
          }
        }
        if (!reading) break;
      }
      toast.success('AI text generation complete!');
    } catch (err: any) {
      console.error('Failed to generate text with AI:', err);
      toast.error(err.message || 'AI text generation failed.');
    } finally {
      setIsGeneratingText(false);
      editor.chain().focus().run(); 
    }
  };

  const handleSaveDocument = async () => {
    if (!editorRef.current || !documentMetadata?.id || !isEditable) {
      toast.error('Cannot save document. Editor not ready, document ID missing, or not in edit mode.');
      return;
    }
    if (!hasUnsavedChanges) {
      toast.info('No changes to save.');
      return;
    }

    setIsSaving(true);
    try {
      const htmlContent = editorRef.current.getHTML();
      // Backend expects htmlContent. Add other fields if your updateDocument service needs them.
      // e.g. jsonContent: editorRef.current.getJSON()
      const payload: Partial<DocumentMetadata> & { htmlContent: string } = { 
        htmlContent,
        // extractedText might need to be regenerated on backend if htmlContent changes significantly
      };

      const { data: updatedDoc, error: saveError } = await updateDocument(documentMetadata.id, payload);

      if (saveError) throw saveError;

      toast.success('Document saved successfully!');
      setHasUnsavedChanges(false);
      if (updatedDoc) {
        // Optionally update local metadata if the save returns the full updated document
        // For instance, if 'updated_at' or 'version' changes
        // Since updateDocument doesn't return the full doc, we might need to refetch or be optimistic
        // For now, let's assume success means our current data is mostly fine, or refetch if needed.
        // If specific fields like a version or updated_at were returned, we could do:
        // setDocumentMetadata(prev => ({ ...prev, ...updatedDoc.data })); // Original problematic line
        // Correct approach: updateDocument returns { success, error }.
        // If you need the updated document, updateDocument service should return it, or you refetch.
        // For now, if saveError is not thrown, we assume success.
      }
    } catch (err: any) {
      console.error('Failed to save document:', err);
      toast.error(err.message || 'Failed to save document.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportToWord = async () => {
    if (!editorRef.current || !documentMetadata) {
      toast.error('Editor is not ready or document data is missing.');
      return;
    }
    
    const htmlContent = editorRef.current.getHTML();

    // Determine the base name for the file
    let baseName = "Benchwise_Word_Document"; // Generic fallback
    if (documentMetadata) {
      if (documentMetadata.title && documentMetadata.title.trim() !== "") {
        baseName = documentMetadata.title; // Prefer title
      } else if (documentMetadata.filename && documentMetadata.filename.trim() !== "") {
        // Use filename if title is not available/empty, stripping potential existing extension
        baseName = documentMetadata.filename.replace(/\.[^/.]+$/, ""); 
      }
    }
    // Sanitize baseName and ensure it ends with .docx
    // Remove characters problematic in filenames and limit length
    const sanitizedBaseName = baseName.replace(/[<>:"/\\|?*]+/g, '_').substring(0, 200);
    const finalFileNameForExport = `${sanitizedBaseName}.docx`;

    setIsExportingWord(true);
    toast.info(`Exporting ${finalFileNameForExport} to Word...`);

    try {
      const { data, error } = await supabase.functions.invoke('generate-docx', {
        body: { htmlContent, fileName: finalFileNameForExport }, // Pass the determined filename
      });

      if (error) throw error;

      // Expect data to be { success: true, downloadUrl: string, fileName: string }
      if (data && data.success && data.downloadUrl && data.fileName) {
        const a = document.createElement('a');
        a.href = data.downloadUrl;
        a.download = data.fileName; // Use the filename from the server response
        document.body.appendChild(a);
        a.click();
        // No need for window.URL.revokeObjectURL as we are not using a blob URL
        a.remove();
        toast.success('Document export to Word initiated successfully!');
      } else {
        console.error('Unexpected response from generate-docx function:', data);
        const errorMessage = data?.error || 'Unexpected response format from Word export function.';
        throw new Error(errorMessage);
      }
    } catch (err: any) {
      console.error("Word export failed:", err);
      toast.error(`Word export failed: ${err.message}`);
    } finally {
      setIsExportingWord(false);
    }
  };
  
  const handleExportToPdf = async () => {
    if (!editorRef.current || !documentMetadata) {
      toast.error('Editor is not ready or document data is missing.');
      return;
    }

    const htmlContent = editorRef.current.getHTML();
    let baseName = "Benchwise_PDF_Document";
    if (documentMetadata.title && documentMetadata.title.trim() !== "") {
      baseName = documentMetadata.title;
    } else if (documentMetadata.filename && documentMetadata.filename.trim() !== "") {
      baseName = documentMetadata.filename.replace(/\.[^/.]+$/, "");
    }
    const sanitizedBaseName = baseName.replace(/[<>:"/\\|?*]+/g, '_').substring(0, 200);
    const finalFileNameForExport = `${sanitizedBaseName}.pdf`;

    setIsExportingPdf(true);
    toast.info(`Exporting ${finalFileNameForExport} to PDF...`);

    try {
      const { data } = await supabase.functions.invoke('generate-pdf-from-html', {
        body: { htmlContent, fileName: finalFileNameForExport },
      });

      if (data && data.downloadUrl) {
        const a = document.createElement('a');
        a.href = data.downloadUrl;
        a.target = '_blank'; // Open in new tab
        // Do NOT set a.download, so browser opens the PDF in a new tab
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast.success('PDF opened in new tab!');
      } else {
        throw new Error('PDF export failed: No download URL returned.');
      }
    } catch (err: any) {
      toast.error(`PDF export failed: ${err.message}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (isLoading && !error) {
    // console.log('[NewDocumentReviewerModule] RENDER: isLoading is true, showing loading message.');
    return (
      <div className="flex justify-center items-center h-full">
        <div>Loading document details...</div> {/* Replace with a proper Skeleton loader if available */}
      </div>
    );
  }

  if (error) {
    // console.log('[NewDocumentReviewerModule] RENDER: error is present, showing error message:', error);
    return (
      <div className="flex justify-center items-center h-full text-red-500">
        <p>Error: {error}</p>
      </div>
    );
  }

  if (!documentMetadata) {
    // console.log('[NewDocumentReviewerModule] RENDER: documentMetadata is null/undefined, showing no document data message.');
     return (
      <div className="flex justify-center items-center h-full">
        <p>No document data found or document ID is missing.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full">
      {/* Main Content Area (Editor + Right Panel) */}
      <div className="flex-1 flex flex-col bg-background text-foreground dark:bg-dark-background dark:text-dark-foreground relative">
        {/* Rewrite Suggestion Bar - positioned within the main content flow, above editor */}
        <RewriteSuggestionBar 
          isVisible={isRewriteBarVisible}
          suggestion={rewriteSuggestion}
          isLoading={isRewriteLoading}
          error={rewriteError}
          onAccept={handleAcceptRewrite}
          onDecline={handleDeclineRewrite}
        />

        <div className="flex flex-1 overflow-hidden p-1 pt-0"> {/* pt-0 because bar has padding */}
          {/* Left Column: Editor Area */}
          <div className="flex-1 flex flex-col border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm bg-background dark:bg-dark-background m-1">
            {/* Document Header */}
            <div className="p-4 pb-2 border-b border-gray-200 dark:border-gray-700">
              <h1 className="text-2xl font-semibold truncate" title={documentMetadata?.filename || 'Untitled Document'}>
                {documentMetadata?.filename || 'Untitled Document'}
              </h1>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">Type: {documentMetadata?.fileType || 'N/A'}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Status: {documentMetadata?.processingStatus || 'N/A'}</span>
                <Button
                  onClick={toggleEditMode}
                  variant={isEditable ? 'primary' : 'secondary'}
                  size="sm"
                  className=""
                >
                  {isEditable ? 'Switch to View Mode' : 'Enable Editing'}
                </Button>
                {isEditable && (
                  <Button
                    onClick={handleSaveDocument}
                    disabled={!hasUnsavedChanges || isSaving}
                    size="sm"
                    variant="default" // Or another appropriate variant
                    className="flex items-center"
                  >
                    <Save className="h-4 w-4 mr-1.5" />
                    {isSaving ? 'Saving...' : (hasUnsavedChanges ? 'Save Changes' : 'Saved')}
                  </Button>
                )}
              </div>
            </div>
            {/* Editor itself with its own toolbar */}
            <div className="flex-grow overflow-hidden"> {/* Changed from overflow-y-auto to overflow-hidden as editor toolbar + content manage scrolling */}
              {documentContent !== null && (
                <NewTiptapEditor
                  ref={editorRef}
                  content={documentContent}
                  editable={isEditable}
                  placeholder={isEditable ? 'Start editing the document...' : (documentContent === '<p></p>' || documentContent === '' ? 'Document is empty.' : 'Content is read-only.') }
                  onSummarize={handleSummarize}
                  onRewrite={handleRewrite}
                  onGenerate={handleOpenGeneratePrompt}
                  onContentUpdate={handleContentUpdate}
                  onChangeHtml={(html) => { /* console.log('HTML changed:', html); */ }}
                  onChangeJson={(json) => { /* console.log('JSON changed:', json); */ }}
                />
              )}
            </div>
          </div>

          {/* Right Column: Analysis/Tools Panel - This remains side-by-side with editor area */}
          <div className="w-1/3 flex flex-col border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm bg-background dark:bg-dark-secondary m-1 p-4">
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">Analysis & Tools</h2>
            <div className="flex items-center space-x-2 mb-4">
              <Select onValueChange={(value) => setSelectedAnalysisType(value as AnalysisType)} value={selectedAnalysisType || undefined}>
                <SelectTrigger className="flex-grow">
                  <SelectValue placeholder="Select Analysis Type" />
                </SelectTrigger>
                <SelectContent>
                  {analysisOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleRunAnalysis} disabled={isAnalysisLoading || !selectedAnalysisType || !documentMetadata?.extractedText}>
                {isAnalysisLoading ? 'Analyzing...' : 'Run Analysis'}
              </Button>
            </div>

            <div className="flex-grow overflow-y-auto p-1 mb-4 border-b border-gray-200 dark:border-gray-700">
              {isAnalysisLoading && <p>Loading analysis results...</p>}
              {analysisError && <p className="text-red-500">Error: {analysisError}</p>}
              {!isAnalysisLoading && !analysisError && displayedAnalysisResult && selectedAnalysisType && (
                <AnalysisResultRenderer
                  analysisType={selectedAnalysisType}
                  analysisResult={displayedAnalysisResult}
                  onCopyItemText={handleCopyItemText}
                  onAddItemToChatContext={handleAddItemToChatContext}
                  onItemHover={handleItemHover}
                  onItemClick={handleItemClick}
                />
              )}
              {!isAnalysisLoading && !analysisError && !displayedAnalysisResult && (
                selectedAnalysisType ? (
                  <p className="text-gray-500 dark:text-gray-400">Run the analysis to get AI powered Intelligence.</p>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">Select an analysis type and click 'Run Analysis' to see results.</p>
                )
              )}
            </div>

            {/* Export Controls */}
            <div className="flex flex-col space-y-2">
              <h3 className="text-md font-semibold">Export Document</h3>
              <Button 
                onClick={handleExportToWord} 
                variant="outline" 
                size="sm" 
                className="w-full flex items-center justify-center"
                disabled={isExportingWord || isExportingPdf}
              >
                {isExportingWord ? (
                  <Sparkles className="animate-spin h-4 w-4 mr-1.5" /> // Simple spinner
                ) : (
                  <FileText className="h-4 w-4 mr-1.5" />
                )}
                {isExportingWord ? 'Exporting Word...' : 'Export as DOCX'}
              </Button>
              <Button 
                onClick={handleExportToPdf} 
                variant="outline" 
                size="sm" 
                className="w-full flex items-center justify-center"
                disabled={isExportingPdf || isExportingWord}
              >
                {isExportingPdf ? (
                  <Sparkles className="animate-spin h-4 w-4 mr-1.5" /> // Simple spinner
                ) : (
                  <FileBarChart2 className="h-4 w-4 mr-1.5" />
                )}
                {isExportingPdf ? 'Exporting PDF...' : 'Export as PDF'}
              </Button>
            </div>

          </div>
        </div>
      </div>
      
      <SummaryModal 
        isOpen={isSummaryModalOpen} 
        onClose={() => setIsSummaryModalOpen(false)} 
        summaryText={summaryContent} 
        isLoading={isSummaryLoading}
      />
      <GeneratePromptModal 
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onSubmit={handleSubmitGeneratePrompt}
        isLoading={isGeneratingText}
      />
    </div>
  );
};

export default NewDocumentReviewerModule; 