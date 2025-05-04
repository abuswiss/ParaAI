import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSetAtom, useAtom } from 'jotai';
import { addTaskAtom, updateTaskAtom, removeTaskAtom, chatPreloadContextAtom, activeEditorItemAtom, activeCaseIdAtom } from '@/atoms/appAtoms';
import { getDocumentById, getDocumentUrl, DocumentMetadata } from '@/services/documentService';
import {
  analyzeDocument,
  getDocumentAnalyses,
  DocumentAnalysisResult,
  AnalysisType,
  StructuredAnalysisResult
} from '@/services/documentAnalysisService';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { TextSelect, Users, ListChecks, ShieldAlert, CalendarDays, FileWarning, Download, FileSearch, Image as ImageIcon, StickyNote, Info, Gavel, Play } from 'lucide-react';
import TiptapEditor, { TiptapEditorRef } from '../editor/TiptapEditor';
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from "@/components/ui/scroll-area";
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

// *** ADDED & EXPORTED: Define type for highlight position ***
export interface HighlightPosition {
    start: number;
    end: number;
}

// *** ADDED & EXPORTED: Define type for a single highlight item ***
export interface HighlightInfo extends HighlightPosition {
    type: AnalysisType;
    details: ProcessedAnalysisItem;
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

interface ProcessedAnalysisItem { // Defined locally
  text?: string;
  type?: string;
  title?: string;
  start: number | null;
  end: number | null;
}

// Restore DocumentViewerProps interface
interface DocumentViewerProps {
  documentId: string;
}

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
  const [summaryCompleted, setSummaryCompleted] = useState<boolean>(false);
  const [activeHighlightPosition, setActiveHighlightPosition] = useState<HighlightPosition | null>(null);
  const [hoveredHighlightPosition, setHoveredHighlightPosition] = useState<HighlightPosition | null>(null);

  const addTask = useSetAtom(addTaskAtom);
  const updateTask = useSetAtom(updateTaskAtom);
  const removeTask = useSetAtom(removeTaskAtom);
  const setChatPreloadContext = useSetAtom(chatPreloadContextAtom);
  const setActiveEditorItem = useSetAtom(activeEditorItemAtom);
  const [activeCaseId, setActiveCaseId] = useAtom(activeCaseIdAtom);

  const editorRef = useRef<TiptapEditorRef>(null);

  // Replace the existing useMemo with the new version from the user query
  const allHighlights = useMemo(() => {
    // Only show highlights for the currently selected analysis type
    if (!selectedAnalysisType || !analysisHistory) {
      // console.log('[DocumentViewer] No selected analysis type or history, returning empty highlights.'); // Keep logs minimal
      return [];
    }
    
    const highlights: HighlightInfo[] = [];
    console.log(`[DocumentViewer] Calculating highlights for selected type: ${selectedAnalysisType}`);
    
    try {
      // Find the latest analysis result matching the selected type
      const relevantAnalysis = analysisHistory
          .filter(a => a.analysisType === selectedAnalysisType)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]; // Get the most recent one

      if (!relevantAnalysis || !relevantAnalysis.result) {
        console.log(`[DocumentViewer] No matching analysis found for type: ${selectedAnalysisType}`);
        return [];
      }

      // Debug the actual shape of the result data
      console.log(`[DocumentViewer] Found analysis result structure:`, relevantAnalysis.result);
      
      // Make sure to access the right property based on analysis type
      const resultData = relevantAnalysis.result;

      // Extract items based on the selected analysis type key
      const items: ProcessedAnalysisItem[] | undefined = (resultData as { [key: string]: ProcessedAnalysisItem[] })[selectedAnalysisType];

      console.log(`[DocumentViewer] Items for ${selectedAnalysisType}:`, items);

      if (Array.isArray(items)) {
          items.forEach(item => {
              // Only add items with valid positions
              if (item && typeof item.start === 'number' && typeof item.end === 'number' && item.start < item.end) {
                  highlights.push({
                      type: selectedAnalysisType, // Type is now guaranteed to be the selected one
                      start: item.start,
                      end: item.end,
                      details: { ...item } // Include all original details
                  });
                  // console.log(`[DocumentViewer] Added highlight: ${item.start}-${item.end}`); // Keep logs minimal
              } else {
                  console.debug(`[DocumentViewer] Item with invalid position not added: ${JSON.stringify(item)}`);
              }
          });
      } else if (selectedAnalysisType === 'summary') {
          // Handle summary - it doesn't have highlights
          console.log('[DocumentViewer] Summary type selected, no highlights to generate.');
      } else {
          console.warn(`[DocumentViewer] Result for type ${selectedAnalysisType} exists but is not an array:`, items);
      }

      // Filter duplicates - might still be useful if AI returns overlapping items for the *same* analysis
      const uniqueHighlights = highlights.filter((highlight, index, self) => 
          index === self.findIndex(h => h.start === highlight.start && h.end === highlight.end)
      );
      console.log(`[DocumentViewer] Total unique highlights calculated: ${uniqueHighlights.length}`);
      return uniqueHighlights;
    } catch (error) {
      console.error('[DocumentViewer] Error processing highlights from history:', error);
      return [];
    }
  }, [analysisHistory, selectedAnalysisType]);

  useEffect(() => {
    let isMounted = true;

    const fetchAllData = async () => {
      if (!isMounted) return;
      try {
        // Reset analysis state on document change/mount
        console.log(`[DocumentViewer ${documentId}] Resetting analysis state...`);
        setAnalysisHistory([]);
        setCurrentAnalysisResult(null);
        setSelectedAnalysisType(null);
        setSummaryContent(null);
        setSummaryCompleted(false);
        setActiveHighlightPosition(null);
        setHoveredHighlightPosition(null);
        setAnalysisError(null); // Also clear previous errors

        setLoading(true);
        setError(null);
        setDocument(null);
        setActiveCase(null);
        setDocumentUrl(null);

        setActiveEditorItem({ type: 'document', id: documentId });

        const { data: docData, error: docError } = await getDocumentById(documentId);
        if (!isMounted) return;
        if (docError) throw docError;
        if (!docData) throw new Error('Document not found');
        setDocument(docData);

        if (docData.caseId) {
          if (!activeCaseId) {
            setActiveCaseId(docData.caseId);
            console.log(`DocumentViewer: Active case was null, setting to document's case ID: ${docData.caseId}`);
          }
          const { data: caseData, error: caseError } = await getCaseById(docData.caseId);
          if (!isMounted) return;
          if (caseError) console.warn('Could not fetch case details:', caseError);
          else setActiveCase(caseData);
        } else {
             console.warn(`Document ${documentId} does not have an associated caseId.`);
        }

        const { data: historyData, error: historyError } = await getDocumentAnalyses(documentId);
        if (!isMounted) return;
        if (historyError) console.warn('Could not fetch analysis history:', historyError);
        const validHistory = historyData || [];
        setAnalysisHistory(validHistory);

        const summaryResult = validHistory.find(
          (analysis): analysis is DocumentAnalysisResult & { summary: string } =>
            analysis !== null &&
            typeof analysis === 'object' &&
            'summary' in analysis &&
            typeof analysis.summary === 'string'
        );

        if (summaryResult) {
            setSummaryContent(summaryResult.summary);
            setSummaryCompleted(true);
            if (activeTab === 'summary') {
                setSelectedAnalysisType('summary');
                setCurrentAnalysisResult({ summary: summaryResult.summary });
            }
        } else {
             setSummaryCompleted(false);
        }

        // Access the array based on the key, asserting the type
        const contentType = docData?.contentType;
        if (contentType && typeof contentType === 'string' && !['text/plain', 'application/json', 'text/markdown'].includes(contentType)) {
          // Only fetch URL if storagePath exists
          if (docData.storagePath) {
            const { data: urlData, error: urlError } = await getDocumentUrl(docData.storagePath);
            if (!isMounted) return;
            if (urlError) console.warn('Could not fetch document URL:', urlError); 
            else setDocumentUrl(urlData ?? null);
          } else {
            console.warn(`Document ${documentId} has non-text content type but no storage path.`);
            setDocumentUrl(null);
          }
        } else {
          setDocumentUrl(null); // It's plain text or similar, no preview URL needed
        }

      } catch (err: unknown) { // Explicitly type catch variable
        console.error("Error fetching document data:", err);
        if (isMounted) {
          const message = err instanceof Error ? err.message : "Failed to load document.";
          setError(message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchAllData();

    return () => {
      isMounted = false;
      console.log(`[DocumentViewer ${documentId}] Unmounting, clearing highlight positions.`);
      // Explicitly clear highlight state on unmount
      setActiveHighlightPosition(null);
      setHoveredHighlightPosition(null);
    };
  }, [documentId, setActiveEditorItem, activeCaseId, setActiveCaseId]);

  useEffect(() => {
    if (activeTab === 'preview' && !documentUrl && document?.storagePath && !loading) {
        const fetchUrlForPreview = async () => {
            console.log('Fetching URL for preview tab...');
            try {
                 const isPlainText = document.contentType === 'text/plain' || document.fileType === 'txt' || document.storagePath === 'ai-generated';

                 if (isPlainText) {
                     console.log('Document is text-based or AI-generated, skipping URL fetch for preview.');
                     setDocumentUrl(null);
                     return;
                 }
                 
                 setDocumentUrl(null);
                 const urlResponse = await getDocumentUrl(document.storagePath!);
                 if (urlResponse.error) throw urlResponse.error;
                 setDocumentUrl(urlResponse.data);
                 setError(null);
            } catch (err) {
                 console.error('Error fetching document URL for preview:', err);
                 if (!(document.storagePath === 'ai-generated' && err instanceof Error && err.message.includes('Object not found'))) {
                    setError('Failed to load document preview URL.'); 
                 }
                 setDocumentUrl(null);
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

    console.log(`Running analysis type: ${type} for doc: ${document.id}`);

    try {
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

      if (type === 'summary') {
          if (typeof data === 'object' && data !== null && 'summary' in data && 'summaryAnalysis' in data) {
             setSummaryContent(data.summary);
             setSummaryCompleted(true);
          } else if (typeof data === 'string') {
             setSummaryContent(data);
             setSummaryCompleted(true);
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
      setCurrentAnalysisResult({ error: message }); 
    } finally {
      setIsAnalysisLoading(false);
    }
  };

  const handleInitiateChat = (analysisItem: ProcessedAnalysisItem, analysisType: AnalysisType) => {
    if (!document?.extractedText) {
        console.warn('Cannot initiate chat without document text.');
        return; 
    }
    console.log(`Initiating chat for ${analysisType}:`, analysisItem);
    setChatPreloadContext({
      analysisItem,
      analysisType,
      documentText: document.extractedText, 
    });
  };

  const handleFindingClick = useCallback((position: HighlightPosition | null) => {
    setActiveHighlightPosition(position);
    setHoveredHighlightPosition(null);
  }, []);

  const handleFindingHoverEnter = useCallback((position: HighlightPosition | null) => {
    if (position) {
      setHoveredHighlightPosition(position);
    }
  }, []);

  const handleFindingHoverLeave = useCallback(() => {
    setHoveredHighlightPosition(null);
  }, []);

  const renderLoading = () => (
    <div className="flex justify-center items-center h-full">
        <Spinner size="lg" />
    </div>
  );

  const renderError = (errorMessage: string) => (
    <div className="p-4">
        <Alert variant="destructive">
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
        onFindingHoverEnter={handleFindingHoverEnter}
        onFindingHoverLeave={handleFindingHoverLeave}
        hoveredHighlightPosition={hoveredHighlightPosition}
        onRegenerateAnalysis={handleRunAnalysis}
      />
    );
  };

  const renderTextContent = () => {
    if (!document) return renderLoading(); 

    if (!document?.editedContent && !document?.extractedText && !loading) {
      return (
        <div className="text-center p-8 flex flex-col justify-center items-center h-full">
          <FileSearch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Text has not been extracted for this document yet.</p>
          <p className="text-xs text-muted-foreground">(Status: {document.processingStatus || 'Unknown'})</p>
        </div>
      );
    }

    const displayContent = document?.editedContent || document?.extractedText || '';

    return (
      <div className="flex h-full">
        <div className="flex-1 h-full border-r overflow-hidden"> 
          <TiptapEditor
              ref={editorRef} 
              content={displayContent || ''}
              editable={false}
              className="h-full border-0 shadow-none rounded-none"
              placeholder="Loading document text..."
              allHighlights={allHighlights}
              activeHighlightPosition={activeHighlightPosition}
              hoveredHighlightPosition={hoveredHighlightPosition}
          />
        </div>
      </div>
    );
  };

  const renderPreviewContent = () => {
    if (!document) return renderLoading();

    const isPlainText = document?.contentType === 'text/plain' || document?.fileType === 'txt';

    if (isPlainText) {
      const displayContent = document?.editedContent || document?.extractedText || '';
      if (displayContent) {
        return (
          <div className="flex h-full">
            <div className="flex-1 h-full p-1">
              <TiptapEditor
                ref={editorRef}
                content={displayContent || ''}
                editable={false}
                className="h-full border-0 shadow-none bg-transparent"
                allHighlights={allHighlights}
                activeHighlightPosition={activeHighlightPosition}
                hoveredHighlightPosition={hoveredHighlightPosition}
              />
            </div>
          </div>
        );
      } else {
        return (
            <div className="text-center p-8 flex flex-col justify-center items-center h-full">
                <FileSearch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No text content available for preview.</p>
            </div>
        );
      }
    }

    if (error && error.includes('preview')) {
         return renderError(error);
    }

    if (!documentUrl) return (
        <div className="flex justify-center items-center h-64">
            <Spinner />
            <span className="ml-2 text-muted-foreground">Loading preview...</span>
        </div>
    );
    
    const fileType = document?.contentType || '';
    const containerStyle = "w-full h-[calc(100vh-200px)] flex justify-center items-center p-4";
    const iframeStyle = "w-full h-full border-0";
    const imgStyle = "max-w-full max-h-full object-contain";

    if (fileType.includes('pdf')) {
      return <iframe src={documentUrl} className={iframeStyle} title={document.filename} />;
    } else if (fileType.includes('image')) {
      return <div className={containerStyle}><img src={documentUrl} alt={document.filename} className={imgStyle}/></div>;
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

  if (loading && !document) return renderLoading();
  if (error && !error.includes('preview') && activeTab !== 'preview') return renderError(error);
  if (!document) return renderError('Document data could not be loaded.');

  const isSummaryLoading = isAnalysisLoading && selectedAnalysisType === 'summary';
  const summaryTabDisabled = !summaryContent && !isSummaryLoading;

  return (
    <div className="flex flex-col h-full p-4 bg-background">
      <div className="mb-4 flex justify-between items-center">
        <Breadcrumb 
          items={[
            { label: 'Cases', href: '/cases' },
            ...(activeCase ? [{ label: activeCase.name, href: `/files?caseId=${activeCase.id}` }] : []),
            { label: document?.filename || 'Document' },
          ]} 
          className="flex-grow mr-4"
        />
       <div className="flex items-center space-x-2 flex-shrink-0">
         <Select 
            value={selectedAnalysisType || ''}
            onValueChange={(value: string) => handleRunAnalysis(value as AnalysisType)} 
            disabled={isAnalysisLoading || loading}
          >
              <SelectTrigger 
                  className={cn(
                      "w-[180px] h-8 text-xs border-input bg-background",
                      "hover:border-primary/70 hover:bg-muted",
                      "data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-primary/20",
                      "transition-all"
                  )}
              >
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
            className={cn(
                "h-8 font-medium",
                !(!selectedAnalysisType || isAnalysisLoading || loading) && 
                "bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:shadow-lg transform hover:scale-[1.02] transition-all duration-150 ease-in-out",
             )}
          >
              {isAnalysisLoading ? <Spinner size="xs" className="mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />} 
              Run
         </Button>
       </div>
      </div>

      {!loading && !error && document && (
          <p className="text-sm text-muted-foreground italic text-center mb-3 -mt-2">
              <Info className="h-3.5 w-3.5 mr-1 inline-block relative -top-px"/>
              Need insights? Ask about this document in the AI Chat.
          </p>
      )}

      <div className="flex-grow flex overflow-hidden">
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
                 <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value as 'text' | 'preview' | 'summary')} className="flex flex-col h-full">
                     <TabsList className="flex-shrink-0 rounded-none border-b justify-start px-3 bg-muted/30">
                         <TabsTrigger value="text" disabled={!document?.extractedText}><TextSelect size={14} className="mr-1.5"/> Text</TabsTrigger>
                         <TabsTrigger value="preview" disabled={!document?.storagePath}><ImageIcon size={14} className="mr-1.5"/> Preview</TabsTrigger>
                         <TabsTrigger 
                            value="summary" 
                            disabled={summaryTabDisabled} 
                            data-state={summaryCompleted ? 'completed' : 'incomplete'}
                            className={cn(
                                "data-[state=completed]:text-green-600 dark:data-[state=completed]:text-green-400",
                                "data-[state=completed]:font-medium"
                            )}
                         >
                            <StickyNote size={14} className="mr-1.5"/> Summary
                         </TabsTrigger>
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
