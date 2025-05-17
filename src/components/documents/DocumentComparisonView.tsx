import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { AlertTriangle, Sparkles, Info, FileText, SearchCheck, Bot, ListChecks, Columns } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { getDocumentById } from '@/services/documentService';
import type { DocumentMetadata } from '@/services/documentService';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Textarea';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import ReactMarkdown from 'react-markdown';
import DiffViewer from './DiffViewer'; // Assuming DiffViewer is in the same directory

interface DocumentComparisonViewProps {
  doc1Id: string;
  doc2Id: string;
  caseId: string; // Retained for context, though not directly used in this revision's core logic
}

interface FocusedDifference {
  area: string;
  originalSnippet: string;
  modifiedSnippet: string;
  observation: string;
}

interface AiAnalysisResult {
  summary: string;
  focusedDifferences: FocusedDifference[];
}

const DocumentComparisonView: React.FC<DocumentComparisonViewProps> = ({
  doc1Id,
  doc2Id,
  // caseId // Currently unused in this component's logic directly
}) => {
  const [doc1Content, setDoc1Content] = useState<string | null>(null);
  const [doc2Content, setDoc2Content] = useState<string | null>(null);
  const [doc1Meta, setDoc1Meta] = useState<DocumentMetadata | null>(null);
  const [doc2Meta, setDoc2Meta] = useState<DocumentMetadata | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(true);
  const [contentError, setContentError] = useState<string | null>(null);

  const [comparisonGoal, setComparisonGoal] = useState<string>('');
  const [submittedGoal, setSubmittedGoal] = useState<string>('');

  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisResult | null>(null);
  const [isAiAnalysisLoading, setIsAiAnalysisLoading] = useState<boolean>(false);
  const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null);

  const commonGoals = [
    "Identify changes in payment terms or financial amounts.",
    "Highlight discrepancies in dates or timelines.",
    "Pinpoint differences in party names or responsibilities.",
    "Focus on changes to termination clauses.",
    "Summarize alterations to scope of work or deliverables."
  ];

  useEffect(() => {
    const loadDocumentContent = async () => {
      if (!doc1Id || !doc2Id) {
        setIsLoadingContent(false);
        setContentError("Document IDs are missing.");
        return;
      }

      setIsLoadingContent(true);
      setContentError(null);
      setDoc1Content(null);
      setDoc2Content(null);
      setDoc1Meta(null);
      setDoc2Meta(null);
      // Reset AI analysis when documents change
      setAiAnalysis(null);
      setAiAnalysisError(null);
      setIsAiAnalysisLoading(false);
      // Don't reset comparisonGoal, user might want to use the same goal for new docs

      try {
        const [result1, result2] = await Promise.all([
          getDocumentById(doc1Id),
          getDocumentById(doc2Id)
        ]);

        if (result1.error) throw new Error(`Failed to load Document 1: ${result1.error.message}`);
        if (!result1.data) throw new Error(`Document 1 (ID: ${doc1Id}) not found.`);
        if (result2.error) throw new Error(`Failed to load Document 2: ${result2.error.message}`);
        if (!result2.data) throw new Error(`Document 2 (ID: ${doc2Id}) not found.`);

        setDoc1Meta(result1.data);
        setDoc2Meta(result2.data);

        const content1 = result1.data.editedContent ?? result1.data.extractedText ?? '';
        const content2 = result2.data.editedContent ?? result2.data.extractedText ?? '';

        setDoc1Content(content1);
        setDoc2Content(content2);
      } catch (err: any) {
        console.error("Error loading document content for comparison:", err);
        setContentError(err.message || 'Failed to load document content.');
      } finally {
        setIsLoadingContent(false);
      }
    };

    loadDocumentContent();
  }, [doc1Id, doc2Id]);

  useEffect(() => {
    const fetchAiAnalysis = async () => {
      if (!doc1Content || !doc2Content || !submittedGoal) {
        // Clear previous AI analysis if no goal is submitted or content is missing
        if (!submittedGoal) setAiAnalysis(null);
        return;
      }

      setIsAiAnalysisLoading(true);
      setAiAnalysisError(null);
      setAiAnalysis(null);

      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          throw new Error('User not authenticated');
        }
        const userId = user.id;

        console.log('Invoking compare-documents-ai function with goal:', submittedGoal);
        const { data, error: functionError } = await supabase.functions.invoke('compare-documents-ai', {
          body: { text1: doc1Content, text2: doc2Content, goal: submittedGoal, userId },
        });

        if (functionError) {
          console.error('Supabase function invocation error:', functionError);
          throw new Error(`AI analysis service failed: ${functionError.message}`);
        }

        if (data?.error) {
          console.error('AI Function error payload:', data.error);
          throw new Error(`AI analysis returned an error: ${data.error}`);
        }

        // Check for summary and focusedDifferences
        if (typeof data?.summary === 'string' && Array.isArray(data?.focusedDifferences)) {
          setAiAnalysis({ 
            summary: data.summary, 
            focusedDifferences: data.focusedDifferences 
          });
          console.log('AI Analysis received successfully with summary and focused differences.');
        } else if (data?.summary) { // Fallback if only summary is present (older function version?)
           setAiAnalysis({ summary: data.summary, focusedDifferences: [] });
           console.warn('AI Analysis received summary but not focusedDifferences. Displaying summary only.');
           setAiAnalysisError('AI analysis provided a summary but detailed differences are unavailable. The AI function might need an update.');
        } else {
          console.warn('AI analysis response did not contain a valid summary or focusedDifferences.', data);
          setAiAnalysis(null);
          setAiAnalysisError('AI analysis did not return the expected data structure (summary and focusedDifferences). The AI might not have found relevant information or the response was malformed.');
        }
      } catch (err: any) {
        console.error("Error fetching AI analysis:", err);
        setAiAnalysisError(err.message || 'An unknown error occurred while fetching the AI analysis.');
      } finally {
        setIsAiAnalysisLoading(false);
      }
    };

    // Trigger AI analysis only when content is loaded, no content errors, and a goal has been submitted
    if (!isLoadingContent && !contentError && doc1Content !== null && doc2Content !== null && submittedGoal) {
      fetchAiAnalysis();
    }
  }, [doc1Content, doc2Content, submittedGoal, isLoadingContent, contentError]);


  const handleAnalyzeButtonClick = () => {
    if (!comparisonGoal.trim()) {
        setAiAnalysisError("Please enter a comparison goal.");
        setAiAnalysis(null); // Clear previous results if any
        return;
    }
    setAiAnalysisError(null); // Clear previous errors
    setSubmittedGoal(comparisonGoal);
  };

  if (isLoadingContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Spinner size="lg" />
        <p className="mt-4 text-lg text-muted-foreground">Loading document content...</p>
        <p className="text-sm text-muted-foreground">Please wait while we fetch the documents for comparison.</p>
      </div>
    );
  }

  if (contentError) {
    return (
      <div className="p-4 md:p-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="text-lg">Error Loading Documents</AlertTitle>
          <AlertDescription>{contentError} Please ensure the selected documents are accessible and try again.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (doc1Content === null || doc2Content === null) {
    // This case should ideally be covered by isLoadingContent or contentError,
    // but as a fallback:
    return (
      <div className="flex justify-center items-center h-full p-8">
        <Info className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-lg text-muted-foreground">Document content is unavailable.</p>
        <p className="text-sm text-muted-foreground">One or both documents could not be loaded or are empty.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 bg-gray-50 dark:bg-slate-900">
      <Card className="shadow-lg dark:bg-slate-800/70 border dark:border-slate-700/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <SearchCheck className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl">Configure Smart Comparison</CardTitle>
          </div>
          <CardDescription>
            Specify your analysis goal to guide the AI in comparing {`"${doc1Meta?.filename || 'Document 1'}"`} and {`"${doc2Meta?.filename || 'Document 2'}"`}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="comparisonGoal" className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1.5">
              Comparison Goal
            </Label>
            <Textarea
              id="comparisonGoal"
              value={comparisonGoal}
              onChange={(e) => setComparisonGoal(e.target.value)}
              placeholder="e.g., Highlight differences in payment terms, identify inconsistencies in event descriptions..."
              rows={3}
              className="mt-1 dark:bg-slate-700/50 dark:text-gray-100 dark:border-slate-600 focus:ring-primary-focus dark:focus:ring-primary-focus-dark"
            />
            <div className="mt-2 text-xs text-muted-foreground dark:text-slate-400">
              <p className="font-medium mb-1">Or try one of these common goals:</p>
              <div className="flex flex-wrap gap-1.5">
                {commonGoals.map((goal, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => setComparisonGoal(goal)}
                    className="py-1.5 dark:hover:bg-slate-700 dark:border-slate-600"
                  >
                    {goal}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <Button onClick={handleAnalyzeButtonClick} disabled={isAiAnalysisLoading || !doc1Content || !doc2Content} className="w-full sm:w-auto">
            {isAiAnalysisLoading && submittedGoal === comparisonGoal ? (
              <>
                <Spinner size="sm" className="mr-2" /> Analyzing...
              </>
            ) : (
              <>
                <Bot className="mr-2 h-4 w-4" /> Analyze with AI
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {(isAiAnalysisLoading || aiAnalysis || aiAnalysisError) && (
        <Card className="shadow-lg dark:bg-slate-800/70 border dark:border-slate-700/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <CardTitle className="text-xl">AI-Powered Insights</CardTitle>
            </div>
            {submittedGoal && <CardDescription>Analysis focused on: "{submittedGoal}"</CardDescription>}
          </CardHeader>
          <CardContent className="text-sm">
            {isAiAnalysisLoading && (
              <div className="flex items-center gap-3 text-muted-foreground p-4">
                <Spinner size="md" /> 
                <div>
                    <p className="font-semibold">Generating AI analysis...</p>
                    <p className="text-xs">This may take a few moments, especially for large documents or complex goals.</p>
                </div>
              </div>
            )}
            {aiAnalysisError && !isAiAnalysisLoading && (
              <Alert variant="destructive" className="text-xs">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>AI Analysis Error</AlertTitle>
                <AlertDescription>{aiAnalysisError}</AlertDescription>
              </Alert>
            )}
            {!isAiAnalysisLoading && !aiAnalysisError && aiAnalysis?.summary && (
              <div className="prose prose-sm dark:prose-invert max-w-none p-3 mb-4 bg-background dark:bg-slate-800 rounded-md border dark:border-slate-700 shadow-sm">
                <h4 className="font-semibold text-base mb-1.5 text-primary dark:text-primary-light flex items-center">
                  <ListChecks className="h-5 w-5 mr-2" /> Overall Summary of Differences
                </h4>
                <ReactMarkdown components={{ p: ({node, ...props}) => <p className="text-sm" {...props} /> }}>{aiAnalysis.summary}</ReactMarkdown>
              </div>
            )}
            {/* Display Focused Differences */}
            {!isAiAnalysisLoading && !aiAnalysisError && aiAnalysis && aiAnalysis.focusedDifferences.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold text-base mb-2 text-primary dark:text-primary-light flex items-center">
                  <Columns className="h-5 w-5 mr-2" /> Detailed Goal-Focused Differences
                </h4>
                <div className="space-y-3">
                  {aiAnalysis.focusedDifferences.map((diff, index) => (
                    <Card key={index} className="bg-background dark:bg-slate-800/70 border dark:border-slate-600/50 overflow-hidden">
                      <CardHeader className="p-3 bg-muted/50 dark:bg-slate-700/30 border-b dark:border-slate-600/50">
                        <CardTitle className="text-sm font-medium flex items-center">
                          <Sparkles className="h-4 w-4 mr-2 text-accent-foreground/80" /> 
                          Area: {diff.area}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 text-xs space-y-2.5">
                        <div>
                          <p className="font-semibold text-muted-foreground mb-0.5">Observation:</p>
                          <p className="text-foreground/90 dark:text-slate-200 whitespace-pre-wrap italic">{diff.observation}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 border-t border-dashed dark:border-slate-600/40">
                          <div>
                            <p className="font-semibold text-red-600 dark:text-red-400/90 mb-0.5">Original (Doc 1 Snippet):</p>
                            {diff.originalSnippet ? 
                              <pre className="p-1.5 bg-red-500/5 dark:bg-red-500/10 border border-red-500/20 dark:border-red-500/30 rounded text-wrap font-mono text-[11px] leading-relaxed">{diff.originalSnippet}</pre> : 
                              <p className="italic text-muted-foreground text-[11px]">(No specific snippet or content was new)</p> }
                          </div>
                          <div>
                            <p className="font-semibold text-green-600 dark:text-green-400/90 mb-0.5">Modified (Doc 2 Snippet):</p>
                             {diff.modifiedSnippet ? 
                              <pre className="p-1.5 bg-green-500/5 dark:bg-green-500/10 border border-green-500/20 dark:border-green-500/30 rounded text-wrap font-mono text-[11px] leading-relaxed">{diff.modifiedSnippet}</pre> : 
                              <p className="italic text-muted-foreground text-[11px]">(No specific snippet or content was removed)</p>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            {!isAiAnalysisLoading && !aiAnalysisError && !aiAnalysis?.summary && (!aiAnalysis || aiAnalysis.focusedDifferences.length === 0) && submittedGoal && (
                 <div className="p-4 text-center text-muted-foreground">
                    <Info className="h-8 w-8 mx-auto mb-2"/>
                    <p>No specific AI insights generated for this goal, or the summary was empty.</p>
                    <p className="text-xs">You can try refining your goal or check the detailed textual differences below.</p>
                 </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-lg dark:bg-slate-800/70 border dark:border-slate-700/50">
        <CardHeader>
           <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl">Detailed Textual Differences</CardTitle>
          </div>
          <CardDescription>
            A side-by-side comparison highlighting all textual changes between the documents.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 md:p-0">
          <div className="border-t dark:border-slate-700/50">
            <DiffViewer
              originalContent={doc1Content}
              newContent={doc2Content}
              originalTitle={doc1Meta?.filename || `Document 1 (ID: ${doc1Id})`}
              newTitle={doc2Meta?.filename || `Document 2 (ID: ${doc2Id})`}
              viewType="split" // Or allow user to toggle: 'unified' | 'split'
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentComparisonView; 