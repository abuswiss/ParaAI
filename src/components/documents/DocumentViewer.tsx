import React, { useState, useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { addTaskAtom, updateTaskAtom, removeTaskAtom } from '@/atoms/appAtoms';
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
import TiptapEditor from '../editor/TiptapEditor';
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

interface DocumentViewerProps {
  documentId: string;
}

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

  const addTask = useSetAtom(addTaskAtom);
  const updateTask = useSetAtom(updateTaskAtom);
  const removeTask = useSetAtom(removeTaskAtom);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
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

        const { data: docData, error: docError } = await getDocumentById(documentId);
        if (docError) throw docError;
        if (!docData) throw new Error('Document not found');
        setDocument(docData);

        if (docData.caseId) {
          try {
            const { data: caseData, error: caseError } = await getCaseById(docData.caseId);
            if (caseError) console.warn('Could not fetch case details:', caseError);
            else setActiveCase(caseData);
          } catch (caseFetchErr) {
            console.warn('Error fetching case for breadcrumb:', caseFetchErr);
          }
        }
        
        const { data: historyData, error: historyError } = await getDocumentAnalyses(documentId);
        if (historyError) console.warn('Could not fetch analysis history:', historyError);
        const validHistory = historyData || [];
        setAnalysisHistory(validHistory);
        
        const latestSummary = validHistory.find((a: DocumentAnalysisResult) => a.analysisType === 'summary');
        let initialTab: 'text' | 'preview' | 'summary' = 'text';
        if (latestSummary && typeof latestSummary.result === 'string') {
             setSummaryContent(latestSummary.result);
             initialTab = 'summary';
        } else if (docData.extractedText) {
             initialTab = 'text';
        } else if (docData.storagePath) {
            initialTab = 'preview';
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

        if (initialTab !== 'summary' && latestSummary) {
             setSelectedAnalysisType('summary');
             setCurrentAnalysisResult(latestSummary.result);
        } 

      } catch (err) {
        console.error('Error loading document or history:', err);
        setError(err instanceof Error ? err.message : 'Failed to load document data.');
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [documentId]);

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

      if (type === 'summary' && typeof data === 'string') {
        setSummaryContent(data);
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
    if (isAnalysisLoading) {
      return <div className="p-4 text-center"><Spinner size="sm" /> Loading analysis...</div>;
    }
    if (analysisError) {
      return <Alert variant="destructive" className="m-4"><AlertDescription>{analysisError}</AlertDescription></Alert>;
    }
    if (!currentAnalysisResult) {
      return <div className="p-4 text-center text-muted-foreground">Select an analysis type to run.</div>;
    }

    // Handle different analysis types
    switch (selectedAnalysisType) {
      case 'entities':
        const entities = (currentAnalysisResult as any)?.entities as Entity[];
        if (!entities || entities.length === 0) return <div className="p-4 text-muted-foreground">No entities found.</div>;
        return (
          <ScrollArea className="h-full">
            <ul className="p-4 space-y-2 text-sm">
              {entities.map((entity, index) => (
                <li key={index} className="border-b pb-1 mb-1">
                  <span className="font-medium">{entity.text}</span> 
                  <Badge variant="secondary" className="ml-2">{entity.type}</Badge>
                </li>
              ))}
            </ul>
          </ScrollArea>
        );
      case 'clauses':
        const clauses = (currentAnalysisResult as any)?.clauses as Clause[];
        if (!clauses || clauses.length === 0) return <div className="p-4 text-muted-foreground">No key clauses identified.</div>;
        return (
          <ScrollArea className="h-full">
            <ul className="p-4 space-y-3 text-sm">
              {clauses.map((clause, index) => (
                <li key={index} className="border rounded p-2 bg-muted/30">
                  <p className="font-semibold mb-1">{clause.title || `Clause ${index + 1}`}</p>
                  <p className="text-xs text-muted-foreground truncate">{clause.text}</p>
                </li>
              ))}
            </ul>
          </ScrollArea>
        );
      case 'risks':
        const risks = (currentAnalysisResult as any)?.risks as Risk[];
        if (!risks || risks.length === 0) return <div className="p-4 text-muted-foreground">No risks identified.</div>;
        
        const getRiskBadgeVariant = (severity: Risk['severity']): BadgeVariant => {
            switch (severity) {
                case 'Critical': return 'danger';
                case 'High': return 'danger';
                case 'Medium': return 'warning';
                case 'Low': return 'success';
                default: return 'secondary';
            }
        };
        const getRiskIconColor = (severity: Risk['severity']): string => {
             switch (severity) {
                case 'Critical': return 'text-red-600';
                case 'High': return 'text-orange-500';
                case 'Medium': return 'text-yellow-500';
                case 'Low': return 'text-green-500';
                default: return 'text-muted-foreground';
            }
        };

        return (
          <ScrollArea className="h-full">
            <ul className="p-4 space-y-3 text-sm">
              {risks.map((risk, index) => (
                <li key={index} className="border rounded p-2">
                  <p className="font-medium mb-1 flex items-center">
                     <ShieldAlert size={14} className={cn('mr-1.5', getRiskIconColor(risk.severity))} />
                     {risk.explanation}
                  </p>
                  <Badge variant={getRiskBadgeVariant(risk.severity)} className="text-xs capitalize">{risk.severity}</Badge>
                   {(risk as any).suggestion && <p className="text-xs text-muted-foreground mt-1 pl-5 italic">Suggestion: {(risk as any).suggestion}</p>} 
                </li>
              ))}
            </ul>
          </ScrollArea>
        );
       case 'timeline':
        const timelineEvents = (currentAnalysisResult as any)?.timeline as TimelineEvent[];
        if (!timelineEvents || timelineEvents.length === 0) return <div className="p-4 text-muted-foreground">No timeline events extracted.</div>;
        return (
           <ScrollArea className="h-full">
              <ul className="p-4 space-y-3 text-sm">
                {timelineEvents.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((event, index) => (
                  <li key={index} className="border-b pb-2">
                     <p className="font-semibold mb-0.5">{new Date(event.date).toLocaleDateString()}</p>
                     {(event as any).type && <p className="text-muted-foreground text-xs mb-1">{(event as any).type}</p>}
                     <p>{event.event}</p>
                  </li>
                ))}
              </ul>
           </ScrollArea>
         );
       case 'privilegedTerms':
         const terms = (currentAnalysisResult as any)?.result as string[]; 
         if (!terms || !Array.isArray(terms) || terms.length === 0) return <div className="p-4 text-muted-foreground">No potentially privileged terms detected.</div>;
         return (
            <ScrollArea className="h-full">
               <ul className="p-4 space-y-1 text-sm">
                 <p className="text-xs text-muted-foreground mb-2">The following terms were flagged as potentially privileged. Review them in context.</p>
                 {terms.map((term, index) => (
                   <li key={index} className="border-b py-1">
                     <span className="font-mono text-primary">{term}</span>
                   </li>
                 ))}
               </ul>
            </ScrollArea>
          );
      default:
        return <div className="p-4 text-muted-foreground">Selected analysis type cannot be displayed here.</div>;
    }
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
              content={document.extractedText || ''} 
              editable={false}
              className="h-full border-0 shadow-none rounded-none"
              placeholder="Loading document text..."
              analysisResult={selectedAnalysisType === 'privilegedTerms' ? { type: 'privilegedTerms', result: (currentAnalysisResult as any)?.result } : undefined}
          />
        </div>
        <ScrollArea className="w-[350px] flex-shrink-0 border-l overflow-y-auto bg-muted/10">
            <div className="p-2 sticky top-0 bg-background z-10 border-b">
                <h3 className="text-sm font-semibold mb-1">Analysis Results</h3>
            </div>
            <div className="p-2">
                {renderAnalysisPanel()}
            </div>
        </ScrollArea>
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

                     <TabsContent value="analysis" className="flex-1 h-full overflow-hidden mt-0 border rounded-b-md bg-muted/30">
                        {renderAnalysisPanel()} 
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
