import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { addTaskAtom, updateTaskAtom, removeTaskAtom, chatPreloadContextAtom, activeEditorItemAtom, activeDocumentContextIdAtom } from '@/atoms/appAtoms';
import { getDocumentById, getDocumentUrl, DocumentMetadata } from '@/services/documentService';
import {
  analyzeDocument, 
  getDocumentAnalyses,
  DocumentAnalysisResult, 
  AnalysisType,
  StructuredAnalysisResult,
  Entity,
  Clause,
  Risk,
  TimelineEvent,
} from '@/services/documentAnalysisService';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { TextSelect, Users, ListChecks, ShieldAlert, CalendarDays, FileWarning, Download, FileSearch, Image as ImageIcon, StickyNote, Info, Gavel, Play } from 'lucide-react';
import TiptapEditor, { TiptapEditorRef } from '../editor/TiptapEditor';
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge, BadgeVariant } from "@/components/ui/Badge";
import Breadcrumb from '../common/Breadcrumb';
import { getCaseById } from '@/services/caseService';
import { Case } from '@/types/case';
import { cn } from '@/lib/utils';
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DocumentAnalyzer from './DocumentAnalyzer';

interface DocumentViewerProps {
  documentId: string;
}

// *** ADDED & EXPORTED: Define type for highlight position ***
export interface HighlightPosition {
    start: number;
    end: number;
}

// *** ADDED & EXPORTED: Define type for a single highlight item ***
export interface HighlightInfo extends HighlightPosition {
    type: AnalysisType;
    details: any; // Contains the specific entity, clause, risk etc.
}

// *** EXPORTED AnalysisType ***
export type { AnalysisType };

const analysisOptions: { value: AnalysisType; label: string; icon?: React.ElementType }[] = [
  { value: 'summary', label: 'Summary', icon: StickyNote },
  { value: 'entities', label: 'Entities', icon: Users },
  { value: 'clauses', label: 'Key Clauses', icon: ListChecks },
  { value: 'risks', label: 'Risk Analysis', icon: ShieldAlert },
  { value: 'timeline', label: 'Timeline', icon: CalendarDays },
  { value: 'privilegedTerms', label: 'Privileged Terms', icon: Gavel },
];

const DocumentViewer: React.FC<DocumentViewerProps> = ({ documentId }) => {
  const [document, setDocument] = useState<DocumentMetadata | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'text' | 'preview' | 'summary'>('text');
  const [selectedAnalysisType, setSelectedAnalysisType] = useState<AnalysisType | null>(null);
  const [currentAnalysisResult, setCurrentAnalysisResult] = useState<StructuredAnalysisResult | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<DocumentAnalysisResult[]>([]);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [summaryContent, setSummaryContent] = useState<string | null>(null);
  const [activeCase, setActiveCase] = useState<Case | null>(null);
  // *** ADDED: State for active highlight ***
  const [activeHighlightPosition, setActiveHighlightPosition] = useState<HighlightPosition | null>(null);

  const addTask = useSetAtom(addTaskAtom);
  const updateTask = useSetAtom(updateTaskAtom);
  const removeTask = useSetAtom(removeTaskAtom);
  const setChatPreloadContext = useSetAtom(chatPreloadContextAtom);
  const setActiveEditorItem = useSetAtom(activeEditorItemAtom);
  const setActiveDocumentContextId = useSetAtom(activeDocumentContextIdAtom);

  // *** ADDED: Ref for the TiptapEditor instance ***
  const editorRef = useRef<TiptapEditorRef>(null);

  // *** ADDED: Memoize the consolidated list of highlights ***
  const allHighlights = useMemo(() => {
    if (!analysisHistory) return [];
    
    const highlights: HighlightInfo[] = [];
    
    try {
      // Process each analysis result in history
      analysisHistory.forEach(analysis => {
        // Skip if analysis result is null or not an object
        if (!analysis || typeof analysis !== 'object') return;
        
        // Process entities
        if ('entities' in analysis && Array.isArray(analysis.entities)) {
          analysis.entities.forEach(entity => {
            if (typeof entity.start === 'number' && typeof entity.end === 'number' && entity.start < entity.end) {
              highlights.push({
                type: 'entities',
                start: entity.start,
                end: entity.end,
                details: {
                  text: entity.text,
                  type: entity.type,
                  explanation: entity.explanation
                }
              });
            }
          });
        }
        
        // Process clauses
        if ('clauses' in analysis && Array.isArray(analysis.clauses)) {
          analysis.clauses.forEach(clause => {
            if (typeof clause.start === 'number' && typeof clause.end === 'number' && clause.start < clause.end) {
              highlights.push({
                type: 'clauses',
                start: clause.start,
                end: clause.end,
                details: {
                  title: clause.title,
                  text: clause.text,
                  analysis: clause.analysis
                }
              });
            }
          });
        }
        
        // Process risks
        if ('risks' in analysis && Array.isArray(analysis.risks)) {
          analysis.risks.forEach(risk => {
            if (typeof risk.start === 'number' && typeof risk.end === 'number' && risk.start < risk.end) {
              highlights.push({
                type: 'risks',
                start: risk.start,
                end: risk.end,
                details: {
                  explanation: risk.explanation,
                  severity: risk.severity,
                  suggestion: risk.suggestion
                }
              });
            }
          });
        }
        
        // Process timeline
        if ('timeline' in analysis && Array.isArray(analysis.timeline)) {
          analysis.timeline.forEach(event => {
            if (typeof event.start === 'number' && typeof event.end === 'number' && event.start < event.end) {
              highlights.push({
                type: 'timeline',
                start: event.start,
                end: event.end,
                details: {
                  date: event.date,
                  event: event.event,
                  type: event.type
                }
              });
            }
          });
        }
        
        // Process privileged terms
        if ('privilegedTerms' in analysis && Array.isArray(analysis.privilegedTerms)) {
          analysis.privilegedTerms.forEach(term => {
            if (typeof term.start === 'number' && typeof term.end === 'number' && term.start < term.end) {
              highlights.push({
                type: 'privilegedTerms',
                start: term.start,
                end: term.end,
                details: {
                  text: term.text,
                  category: term.category,
                  explanation: term.explanation
                }
              });
            }
          });
        }
      });
      
      // Filter out any duplicates (same start and end position)
      const uniqueHighlights = highlights.filter((highlight, index, self) => 
        index === self.findIndex(h => h.start === highlight.start && h.end === highlight.end)
      );
      
      return uniqueHighlights;
    } catch (error) {
      console.error('Error processing highlights:', error);
      return [];
    }
  }, [analysisHistory]);

  useEffect(() => {
    const fetchAllData = async () => {
      let isMounted = true; // Flag to handle async operations after unmount
      try {
        // Reset state at the beginning
        setLoading(true);
        setError(null);
        setDocument(null);
        setActiveCase(null);
        setDocumentUrl(null);
        setAnalysisHistory([]);
        setSelectedAnalysisType(null);
        setCurrentAnalysisResult(null);
        setAnalysisError(null);
        setSummaryContent(null);

        // Set the global document context ID when this document is viewed
        // Ensure this happens only if the component is still mounted
        if (isMounted) {
            setActiveDocumentContextId(documentId);
        }

        const { data: docData, error: docError } = await getDocumentById(documentId);
        if (docError) throw docError;
        if (!docData) throw new Error('Document not found');
        if (!isMounted) return; // Check after async call
        setDocument(docData);
        setActiveEditorItem({ type: 'document', id: documentId });

        if (docData.caseId) {
           const { data: caseData, error: caseError } = await getCaseById(docData.caseId);
           if (!isMounted) return; // Check after async call
           if (caseError) console.warn('Could not fetch case details:', caseError);
           else setActiveCase(caseData);
        }

        const { data: historyData, error: historyError } = await getDocumentAnalyses(documentId);
        if (!isMounted) return; // Check after async call
        if (historyError) console.warn('Could not fetch analysis history:', historyError);
        const validHistory = historyData || [];
        setAnalysisHistory(validHistory);
        
        // Refined: Handle both string and object summary results from history
        const latestSummary = validHistory.find((a: DocumentAnalysisResult) => a.analysisType === 'summary');
        let initialTab: 'text' | 'preview' | 'summary' = 'text';
        let initialSummaryAnalysisResult: StructuredAnalysisResult | null = null;

        if (latestSummary) {
            if (typeof latestSummary.result === 'object' && latestSummary.result !== null && 'summary' in latestSummary.result && 'summaryAnalysis' in latestSummary.result) {
                // Handle structured summary object
                setSummaryContent(latestSummary.result.summary); // Set tab content
                initialSummaryAnalysisResult = latestSummary.result; // Set for analyzer panel
                initialTab = 'summary';
            } else if (typeof latestSummary.result === 'string') {
                // Handle legacy string summary
                setSummaryContent(latestSummary.result);
                initialSummaryAnalysisResult = latestSummary.result; // Pass string to analyzer too?
                initialTab = 'summary';
            }
        }

        // Determine initial tab based on priority: summary > text > preview
        if (initialTab !== 'summary') {
           if (docData.extractedText) {
               initialTab = 'text';
           } else if (docData.storagePath) {
               initialTab = 'preview';
           }
        }

        setActiveTab(initialTab);

        if (initialTab === 'preview' && docData.storagePath) {
             try {
                 const urlResponse = await getDocumentUrl(docData.storagePath);
                 if (urlResponse.error) throw urlResponse.error;
                 setDocumentUrl(urlResponse.data);
             } catch (urlErr) {
                 console.warn('Could not pre-fetch document URL for preview:', urlErr);
             }
        }

        // If we have a summary result from history (and didn't set the tab to summary),
        // pre-select 'summary' in the dropdown and set the analysis panel content
        if (initialSummaryAnalysisResult) { 
             setSelectedAnalysisType('summary');
             setCurrentAnalysisResult(initialSummaryAnalysisResult);
        } 

        if (!latestSummary && docData.processingStatus === 'completed') { 
             console.log('No existing summary found, automatically triggering summary analysis...');
             handleRunAnalysis('summary'); 
        }

        if (!isMounted) return; // Final check before setting derived state

        // ... Set activeTab, documentUrl, summaryContent, currentAnalysisResult etc. ...

        // Auto-trigger summary if needed
        if (!validHistory.some((a: DocumentAnalysisResult) => a.analysisType === 'summary') && docData.processingStatus === 'completed' && isMounted) {
          console.log('No existing summary found, automatically triggering summary analysis...');
          handleRunAnalysis('summary'); // Assuming handleRunAnalysis checks isMounted internally or is safe
        }

      } catch (err) {
        if (isMounted) { // Only update state if mounted
          console.error('Error loading document or history:', err);
          setError(err instanceof Error ? err.message : 'Failed to load document data.');
        }
      } finally {
        if (isMounted) { // Only update state if mounted
          setLoading(false);
        }
      }
    };

    fetchAllData();

    // --- ADD CLEANUP FUNCTION --- 
    return () => {
      isMounted = false; // Set flag
      // Clear context when component unmounts or documentId prop changes
      console.log(`DocumentViewer cleanup for ${documentId}, clearing context.`);
      setActiveDocumentContextId(null);
    };
    // Add setActiveDocumentContextId to dependency array
  }, [documentId, setActiveEditorItem, setActiveDocumentContextId]);

  // *** ADDED: useEffect for scrolling to active highlight ***
  useEffect(() => {
    if (activeHighlightPosition && editorRef.current) {
      const editorInstance = editorRef.current.getEditor();
      if (editorInstance) {
        console.log('Scrolling to highlight:', activeHighlightPosition);
        editorInstance
          .chain()
          .focus() // Focus the editor first
          .setTextSelection(activeHighlightPosition) // Set selection to highlight bounds
          .scrollIntoView() // Scroll the selection into view
          .run();
      }
    }
  }, [activeHighlightPosition]); // Run when activeHighlightPosition changes

  useEffect(() => {
    if (activeTab === 'preview' && !documentUrl && document?.storagePath && !loading) {
        const fetchUrlForPreview = async () => {
            console.log('Fetching URL for preview tab...');
            try {
                 setDocumentUrl(null);
                 const urlResponse = await getDocumentUrl(document.storagePath!);
                 if (urlResponse.error) throw urlResponse.error;
                 setDocumentUrl(urlResponse.data);
            } catch (err) {
                 console.error('Error fetching document URL for preview:', err);
                 setError('Failed to load document preview URL.'); 
            }
        };
        fetchUrlForPreview();
    }
  }, [activeTab, documentUrl, document, loading]);

  const handleRunAnalysis = async (type: AnalysisType | null) => {
    if (!document?.id || isAnalysisLoading || !type) return;

    setSelectedAnalysisType(type);
    setIsAnalysisLoading(true);
    setAnalysisError(null);
    // Don't clear currentAnalysisResult immediately, maybe show stale while loading?
    // setCurrentAnalysisResult(null);

    console.log(`Running analysis type: ${type} for doc: ${document.id}`);

    try {
      // --- TEMPORARILY COMMENT OUT HISTORY CHECK ---
      /*
      const existingResult = analysisHistory.find((a: DocumentAnalysisResult) => a.analysisType === type);
      if (existingResult) {
        console.log('Using existing analysis result from history.');
        setCurrentAnalysisResult(existingResult.result);
        if (type === 'summary' && typeof existingResult.result === 'string') {
          setSummaryContent(existingResult.result);
        }
        setIsAnalysisLoading(false);
        return; 
      }
      */
      // --- END TEMPORARY COMMENT ---

      const { data, error: analysisErr, analysisId } = await analyzeDocument({
        documentId: document.id,
        analysisType: type,
        addTask,
        updateTask,
        removeTask
      });

      if (analysisErr) throw analysisErr;
      if (!data) throw new Error('Analysis did not return any data.');

      console.log(`Analysis result for ${type}:`, data);
      setCurrentAnalysisResult(data);

      // Refined: Handle both string and object summary results upon completion
      if (type === 'summary') {
          if (typeof data === 'object' && data !== null && 'summary' in data && 'summaryAnalysis' in data) {
             // Handle structured summary object
             setSummaryContent(data.summary); // Set tab content
             // setCurrentAnalysisResult(data) was already called, so analyzer gets the object
          } else if (typeof data === 'string') {
             // Handle legacy string summary
             setSummaryContent(data);
             // setCurrentAnalysisResult(data) was already called, so analyzer gets the string
          }
      }

      if (analysisId) {
        const newHistoryEntry: DocumentAnalysisResult = {
          id: analysisId,
          documentId: document.id,
          analysisType: type,
          result: data,
          createdAt: new Date().toISOString()
        };
        setAnalysisHistory(prev => [...prev, newHistoryEntry]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }

    } catch (err) {
      console.error(`Error running analysis type ${type}:`, err);
      const message = err instanceof Error ? err.message : 'Failed to run analysis.';
      setAnalysisError(message);
      // Set current result to an error object to display in DocumentAnalyzer
      setCurrentAnalysisResult({ error: message }); 
    } finally {
      setIsAnalysisLoading(false);
    }
  };

  // Function to handle initiating chat from an analysis item
  const handleInitiateChat = (analysisItem: any, analysisType: AnalysisType) => {
    if (!document?.extractedText) {
        console.warn('Cannot initiate chat without document text.');
        // Maybe show a toast notification?
        return; 
    }
    console.log(`Initiating chat for ${analysisType}:`, analysisItem);
    setChatPreloadContext({
      analysisItem,
      analysisType,
      documentText: document.extractedText,
    });
    // Maybe add logic here to switch focus to a chat panel if it's separate?
  };

  // *** ADDED: Callback for handling clicks on findings in the analyzer panel ***
  const handleFindingClick = useCallback((position: HighlightPosition | null) => {
    // Update active highlight position state
    setActiveHighlightPosition(position);
    
    // If we're clearing the selection, just return
    if (!position) return;
    
    // Add visual feedback that informs the user where to look
    // This will be a brief flash of the highlight area
    const flashTimeout = setTimeout(() => {
      const editorInstance = editorRef.current?.getEditor();
      if (editorInstance) {
        try {
          // Set selection to the position to give immediate visual feedback
          editorInstance.commands.setTextSelection({
            from: position.start,
            to: position.end
          });
          
          // Then clear the selection after a moment to return to normal view
          setTimeout(() => {
            editorInstance.commands.blur();
          }, 800);
        } catch (err) {
          console.error('Error setting text selection:', err);
        }
      }
    }, 100);
    
    return () => clearTimeout(flashTimeout);
  }, []);

  // --- Render Functions ---

  const renderLoading = () => (
    <div className="flex justify-center items-center h-full">
        <Spinner size="lg" />
    </div>
  );

  const renderError = (errorMessage: string) => (
    <div className="p-4">
        <Alert variant="destructive">
            {/* Use Info icon from lucide-react */}
            <Info className="h-4 w-4" /> 
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
    </div>
  );

  const renderAnalysisPanel = () => {
    if (isAnalysisLoading && !currentAnalysisResult) {
      return <div className="p-4 text-center"><Spinner size="sm" /> Loading analysis...</div>;
    }
    if (!selectedAnalysisType && !isAnalysisLoading) {
      return <div className="p-4 text-center text-muted-foreground">Select an analysis type to run.</div>;
    }

    return (
      <DocumentAnalyzer
        resultData={currentAnalysisResult}
        isLoading={isAnalysisLoading}
        error={analysisError}
        onInitiateChat={handleInitiateChat}
        onFindingClick={handleFindingClick}
      />
    );
  };

  const renderTextContent = () => {
    if (!document) return renderLoading(); 

    if (!document.extractedText && !loading) {
      return (
        <div className="text-center p-8 flex flex-col justify-center items-center h-full">
          <FileSearch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Text has not been extracted for this document yet.</p>
          <p className="text-xs text-muted-foreground">(Status: {document.processingStatus || 'Unknown'})</p>
        </div>
      );
    }

    return (
      <div className="flex h-full">
        <div className="flex-1 h-full border-r overflow-hidden"> 
          <TiptapEditor
              ref={editorRef} 
              content={document.extractedText || ''} 
              editable={false}
              className="h-full border-0 shadow-none rounded-none"
              placeholder="Loading document text..."
              allHighlights={allHighlights}
              activeHighlightPosition={activeHighlightPosition}
              analysisResult={selectedAnalysisType === 'privilegedTerms' ? { type: 'privilegedTerms', result: (currentAnalysisResult as any)?.result } : undefined}
          />
        </div>
      </div>
    );
  };

  const renderPreviewContent = () => {
    if (!document) return renderLoading();

    if (error && error.includes('preview')) {
         return renderError(error);
    }

    if (!documentUrl) return (
        <div className="flex justify-center items-center h-64">
            <Spinner />
            <span className="ml-2 text-muted-foreground">Loading preview...</span>
        </div>
    );
    
    const fileType = document.contentType || '';
    const containerStyle = "w-full h-[calc(100vh-200px)] flex justify-center items-center p-4";
    const iframeStyle = "w-full h-full border-0";
    const imgStyle = "max-w-full max-h-full object-contain";

    if (fileType.includes('pdf')) {
      return <iframe src={documentUrl} className={iframeStyle} title={document.filename} />;
    } else if (fileType.includes('image')) {
      return <div className={containerStyle}><img src={documentUrl} alt={document.filename} className={imgStyle}/></div>;
    } else if (fileType.startsWith('text/')) {
       if (document.extractedText) {
          return (
             <div className="flex h-full">
                <div className="flex-1 h-full p-1">
                  <TiptapEditor
                      ref={editorRef}
                      content={document.extractedText}
                      editable={false}
                      className="h-full border-0 shadow-none"
                  />
                </div>
              </div>
          );
       } else {
           return <iframe src={documentUrl} className={iframeStyle} title={document.filename} />;
       }
    } else {
      return (
        <div className="text-center p-8 flex flex-col justify-center items-center h-full">
          <FileWarning className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Preview not available for this file type ({fileType || 'unknown'})</p>
          <Button asChild variant="outline" size="sm">
            <a href={documentUrl} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-2" />
                Download File
            </a>
          </Button>
        </div>
      );
    }
  };

  // --- Main Return --- 
  if (loading && !document) return renderLoading(); // Show loading only if document is null
  if (error && !error.includes('preview') && activeTab !== 'preview') return renderError(error); // Show non-preview error if not on preview tab
  if (!document) return renderError('Document data could not be loaded.');

  // Determine if the summary tab should be disabled
  const isSummaryLoading = isAnalysisLoading && selectedAnalysisType === 'summary';
  const summaryTabDisabled = !summaryContent && !isSummaryLoading;

  return (
    <div className="flex flex-col h-full p-4 bg-background">
      {/* Header Section */} 
      <div className="mb-4 flex justify-between items-center">
        {/* Breadcrumbs */} 
        <Breadcrumb 
          items={[
            { label: 'Cases', href: '/cases' },
            ...(activeCase ? [{ label: activeCase.name, href: `/cases/${activeCase.id}` }] : []),
            { label: document?.filename || 'Document' },
          ]} 
          className="flex-grow mr-4"
        />
         
        {/* Analysis Selector & Button */} 
       <div className="flex items-center space-x-2 flex-shrink-0">
         <Select 
            value={selectedAnalysisType || ''}
            onValueChange={(value: string) => handleRunAnalysis(value as AnalysisType)} 
            disabled={isAnalysisLoading || loading}
          >
              <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="Select Analysis" />
              </SelectTrigger>
              <SelectContent>
                  {analysisOptions.map(option => (
                     <SelectItem key={option.value} value={option.value} className="text-xs">
                         {option.icon && <option.icon className="h-3.5 w-3.5 mr-1.5 inline-block" />} 
                         {option.label}
                     </SelectItem>
                  ))}
              </SelectContent>
          </Select>
         <Button 
            size="sm" 
            onClick={() => handleRunAnalysis(selectedAnalysisType)} 
            disabled={!selectedAnalysisType || isAnalysisLoading || loading}
            className="h-8"
          >
              {isAnalysisLoading ? <Spinner size="xs" className="mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />} 
              Run
         </Button>
         {/* Add Download/Edit buttons? */}
       </div>
      </div>

      {/* Chat Hint */}
      {!loading && !error && document && (
          <p className="text-sm text-muted-foreground italic text-center mb-3 -mt-2">
              <Info className="h-3.5 w-3.5 mr-1 inline-block relative -top-px"/>
              Need insights? Ask about this document in the AI Chat.
          </p>
      )}

      {/* Main Content Area */} 
      <div className="flex-grow flex overflow-hidden">
          {/* Left Panel: Editor/Preview */} 
          <div className="flex-grow flex flex-col overflow-hidden">
              {loading && (
                 <div className="p-4 space-y-2">
                     <Skeleton className="h-6 w-3/4 mb-4" />
                     <Skeleton className="h-4 w-full" />
                     <Skeleton className="h-4 w-full" />
                     <Skeleton className="h-4 w-5/6" />
                 </div>
              )} 
              {error && !loading && renderError(error)} 
              {!loading && !error && (
                 <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="flex flex-col h-full">
                     <TabsList className="flex-shrink-0 rounded-none border-b justify-start px-3 bg-muted/30">
                         <TabsTrigger value="text" disabled={!document?.extractedText}><TextSelect size={14} className="mr-1.5"/> Text</TabsTrigger>
                         <TabsTrigger value="preview" disabled={!document?.storagePath}><ImageIcon size={14} className="mr-1.5"/> Preview</TabsTrigger>
                         <TabsTrigger value="summary" disabled={summaryTabDisabled}><StickyNote size={14} className="mr-1.5"/> Summary</TabsTrigger>
                     </TabsList>
                     <TabsContent value="text" className="flex-1 h-full overflow-hidden mt-0 border rounded-b-md">
                       {renderTextContent()}
                     </TabsContent>

                     <TabsContent value="preview" className="flex-1 h-full overflow-hidden mt-0 border rounded-b-md">
                       {renderPreviewContent()}
                     </TabsContent>
                     
                     <TabsContent value="summary" className="flex-1 h-full overflow-hidden mt-0 border rounded-b-md">
                       <ScrollArea className="h-full p-4">
                         {isSummaryLoading ? (
                           <div className="flex justify-center items-center h-60">
                             <Spinner size="lg" />
                           </div>
                         ) : analysisError && selectedAnalysisType === 'summary' ? (
                           renderError(analysisError)
                         ) : summaryContent ? (
                           <div className="prose prose-sm dark:prose-invert max-w-none">
                             <ReactMarkdown>
                               {summaryContent}
                             </ReactMarkdown>
                           </div>
                         ) : (
                           <div className="text-center p-8">
                             <p className="text-muted-foreground mb-4">No summary available for this document.</p>
                             <Button 
                               variant="secondary" 
                               onClick={() => handleRunAnalysis('summary')}
                               disabled={isAnalysisLoading}
                             >
                               {isAnalysisLoading ? <Spinner size="sm" className="mr-2"/> : <StickyNote size={16} className="mr-2"/>} Generate Summary
                             </Button>
                           </div>
                         )}
                       </ScrollArea>
                     </TabsContent>
                 </Tabs>
              )}
          </div>

          {/* Right Panel: Analysis Results */} 
          <div className="w-[350px] flex-shrink-0 border-l overflow-hidden flex flex-col">
              <div className="p-3 border-b bg-muted/30 flex-shrink-0">
                 <h3 className="text-sm font-medium">Analysis Results</h3> 
              </div>
              <div className="flex-grow overflow-y-auto bg-background">
                 {renderAnalysisPanel()}
              </div>
          </div>
      </div>
    </div>
  );
};

export default DocumentViewer;
