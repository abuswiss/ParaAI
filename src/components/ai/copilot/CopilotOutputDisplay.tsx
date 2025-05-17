import React, { useMemo, useState } from 'react';
import { useCopilot } from '@/context/CopilotContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/Button';
import { Loader2, AlertCircle, Sparkles, CheckCircle, SearchSlash, FileWarning, Edit3, ChevronLeft, ChevronRight, Layers, Repeat2 } from 'lucide-react';
import KeyExcerptsDisplay from './KeyExcerptsDisplay';
import DraftedResponsesDisplay from './DraftedResponsesDisplay';
import IdentifiedObjectionsDisplay from './IdentifiedObjectionsDisplay';
import SimpleListDisplay from './SimpleListDisplay';
import RefinementModal from './RefinementModal';
import { CopilotGoalType, AIAnalysisResults } from '@/types/aiCopilot';
import { Textarea } from '@/components/ui/Textarea';
import { Label } from '@/components/ui/Label';

const CopilotOutputDisplay: React.FC = () => {
  const {
    aiOutputHistory,
    currentOutputIndex,
    setCurrentOutputIndex,
    setAiOutputHistory,
    isLoading,
    error,
    selectedDocumentsContent,
    primaryGoal,
    primaryGoalType,
    initiateCoPilotAnalysis,
    isRefinementModalOpen,
    textToRefine,
    openRefinementModal,
    closeRefinementModal,
    submitRefinement,
  } = useCopilot();

  const [fullRefinementInstructions, setFullRefinementInstructions] = useState('');
  const [showFullRefinementInput, setShowFullRefinementInput] = useState(false);

  const currentAiOutput = useMemo(() => {
    if (currentOutputIndex !== null && aiOutputHistory[currentOutputIndex]) {
      return aiOutputHistory[currentOutputIndex];
    }
    return null;
  }, [aiOutputHistory, currentOutputIndex]);

  const documentsMap = useMemo(() => {
    const map = new Map<string, { filename: string; title?: string }>();
    selectedDocumentsContent.forEach(doc => {
      map.set(doc.id, { filename: doc.filename, title: doc.title });
    });
    return map;
  }, [selectedDocumentsContent]);

  const createSnippetUpdater = (fieldToUpdate: keyof AIAnalysisResults, index?: number) => {
    return (refinedText: string) => {
      if (currentOutputIndex === null) return;
      setAiOutputHistory(prevHistory => {
        const newHistory = [...prevHistory];
        const targetOutput = { ...newHistory[currentOutputIndex] };
        if (typeof index === 'number') {
          if (targetOutput[fieldToUpdate] && Array.isArray(targetOutput[fieldToUpdate])) {
            const targetArray = [...(targetOutput[fieldToUpdate] as any[])];
            if (fieldToUpdate === 'draftedResponses') {
                targetArray[index] = { ...(targetArray[index] as object), draftedText: refinedText };
            }
            (targetOutput[fieldToUpdate] as any) = targetArray;
          }
        } else {
          (targetOutput[fieldToUpdate] as any) = refinedText;
        }
        newHistory[currentOutputIndex] = targetOutput;
        return newHistory;
      });
      closeRefinementModal();
    };
  };

  const handleRefineOverallSummary = () => {
    if (currentAiOutput?.overallSummary) {
      openRefinementModal(currentAiOutput.overallSummary, createSnippetUpdater('overallSummary'));
    }
  };
  
  const handleInitiateFullRefinement = () => {
    if (!fullRefinementInstructions.trim()) return;
    initiateCoPilotAnalysis(true, fullRefinementInstructions);
    setFullRefinementInstructions('');
    setShowFullRefinementInput(false);
  };

  if (isLoading && aiOutputHistory.length === 0) {
    return (
      <Card className="shadow-xl dark:bg-slate-800/70 border dark:border-slate-700/50 min-h-[400px] flex flex-col items-center justify-center">
        <CardHeader className="text-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin mb-4 mx-auto" />
          <CardTitle className="text-xl md:text-2xl">AI CoPilot is Thinking...</CardTitle>
          <CardDescription>Analyzing documents and crafting insights. This may take a moment.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error && !isRefinementModalOpen && !isLoading) {
    return (
      <Card className="shadow-xl dark:bg-slate-800/70 border-red-500 dark:border-red-600 min-h-[300px]">
        <CardHeader>
          <div className="flex items-center text-red-600 dark:text-red-400">
            <AlertCircle className="h-6 w-6 mr-2 flex-shrink-0" />
            <CardTitle className="text-xl md:text-2xl">Analysis Error</CardTitle>
          </div>
          <CardDescription className="text-red-500 dark:text-red-500/90">
            An error occurred during the AI analysis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Details</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
          {currentAiOutput?.rawAIOutput && (
            <details className="w-full text-left mt-3">
              <summary className="text-xs text-muted-foreground dark:text-slate-400 cursor-pointer hover:text-primary">Show Raw AI Output (for debugging)</summary>
              <ScrollArea className="h-32 mt-1 border dark:border-slate-600 rounded-md p-2 bg-background dark:bg-slate-800">
                <pre className="text-xs whitespace-pre-wrap break-all">{currentAiOutput.rawAIOutput}</pre>
              </ScrollArea>
            </details>
          )}
        </CardContent>
      </Card>
    );
  }

  if (currentOutputIndex === null || !currentAiOutput) {
    const canStartAnalysis = selectedDocumentsContent.length > 0 && primaryGoal.trim() !== '';
    return (
      <Card className="shadow-xl dark:bg-slate-800/70 border-2 border-dashed dark:border-slate-700 min-h-[400px] flex flex-col items-center justify-center">
        <CardHeader className="text-center">
          {canStartAnalysis ? 
            <Sparkles className="h-12 w-12 text-muted-foreground/70 mb-4 mx-auto" /> :
            <SearchSlash className="h-12 w-12 text-muted-foreground/70 mb-4 mx-auto" />
          }
          <CardTitle className="text-xl md:text-2xl text-muted-foreground dark:text-slate-300">
            {canStartAnalysis ? "Ready to Analyze" : "AI Output Will Appear Here"}
          </CardTitle>
          <CardDescription className="text-muted-foreground/80 dark:text-slate-400">
            {canStartAnalysis ? 
              'Click "Analyze Documents & Generate Insights" in the configuration panel to begin.' : 
              'Select documents and define your primary goal to activate the CoPilot.'
            }
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (currentAiOutput.isErrorState) {
     return (
      <Card className="shadow-xl dark:bg-slate-800/70 border-red-500 dark:border-red-600">
        <CardHeader>
          <div className="flex items-center text-red-600 dark:text-red-400">
            <AlertCircle className="h-6 w-6 mr-2 flex-shrink-0" />
            <CardTitle className="text-xl md:text-2xl">Analysis Error in This Version</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="py-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error for this analysis attempt</AlertTitle>
            <AlertDescription>{currentAiOutput.overallSummary}</AlertDescription>
          </Alert>
          {currentAiOutput.rawAIOutput && (
             <details className="w-full text-left mt-3">
              <summary className="text-xs text-muted-foreground dark:text-slate-400 cursor-pointer hover:text-primary">Show Raw Error Output</summary>
              <ScrollArea className="h-32 mt-1 border dark:border-slate-600 rounded-md p-2 bg-background dark:bg-slate-800">
                <pre className="text-xs whitespace-pre-wrap break-all">{currentAiOutput.rawAIOutput}</pre>
              </ScrollArea>
            </details>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {aiOutputHistory.length > 0 && (
        <Card className="mb-4 shadow-md dark:bg-slate-800/50">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline"
                size="icon"
                onClick={() => setCurrentOutputIndex(i => (i !== null && i < aiOutputHistory.length - 1) ? i + 1 : i)}
                disabled={currentOutputIndex === null || currentOutputIndex >= aiOutputHistory.length - 1}
                aria-label="Previous analysis version"
                className="dark:hover:bg-slate-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                Version {currentOutputIndex !== null ? aiOutputHistory.length - currentOutputIndex : '-'} of {aiOutputHistory.length}
              </span>
              <Button 
                variant="outline"
                size="icon"
                onClick={() => setCurrentOutputIndex(i => (i !== null && i > 0) ? i - 1 : i)}
                disabled={currentOutputIndex === null || currentOutputIndex === 0}
                aria-label="Next analysis version"
                className="dark:hover:bg-slate-700"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowFullRefinementInput(s => !s)} className="dark:hover:bg-slate-700">
                <Repeat2 className="h-4 w-4 mr-2" /> Refine Entire Analysis
            </Button>
          </CardContent>
          {showFullRefinementInput && (
            <CardContent className="p-3 border-t dark:border-slate-700/50 space-y-2">
                <Label htmlFor="full-refinement-instructions" className="text-sm font-medium">New Instructions for Full Refinement:</Label>
                <Textarea 
                    id="full-refinement-instructions"
                    value={fullRefinementInstructions}
                    onChange={(e) => setFullRefinementInstructions(e.target.value)}
                    placeholder="e.g., Focus more on the financial aspects..." 
                    rows={2}
                    className="dark:bg-slate-700/50 dark:text-gray-100 dark:border-slate-600"
                />
                <Button onClick={handleInitiateFullRefinement} disabled={!fullRefinementInstructions.trim() || isLoading} size="sm">
                    {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : <>Submit Full Refinement</>}
                </Button>
            </CardContent>
          )}
        </Card>
      )}

      <Card className="shadow-xl dark:bg-slate-800/70 border dark:border-slate-700/50">
        <CardHeader className="border-b dark:border-slate-700/70 pb-4">
          <div className="flex justify-between items-start">
            <div className="flex items-center">
              {isLoading && currentOutputIndex === 0 ?
                  <Loader2 className="mr-2.5 h-6 w-6 text-primary animate-spin" /> : 
                  <Layers className="mr-2.5 h-6 w-6 text-primary" />
              }
              <CardTitle className="text-xl md:text-2xl">
                AI CoPilot Analysis Results {aiOutputHistory.length > 1 && currentOutputIndex !== null ? `(Version ${aiOutputHistory.length - currentOutputIndex})` : ''}
              </CardTitle>
            </div>
            {primaryGoalType && <Badge variant="outline" className="font-mono text-xs dark:border-slate-600 dark:text-slate-400 whitespace-nowrap">Original Task: {primaryGoalType.replace(/_/g, ' ')}</Badge>}
          </div>
          <CardDescription className="pt-1">
            Review the insights generated by the AI. This is a Beta feature; always verify critical information.
            {isLoading && currentOutputIndex === 0 && " (Updating current version...)"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 space-y-6">
          {currentAiOutput.overallSummary && (
            <div className="p-4 bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/20 dark:border-primary/30 shadow-sm relative group">
              <div className="flex justify-between items-center mb-1.5">
                <h3 className="text-lg font-semibold text-primary dark:text-primary-light">Overall Summary</h3>
                <Button 
                  variant="ghost"
                  size="sm"
                  onClick={handleRefineOverallSummary}
                  className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 p-1 h-auto dark:text-slate-300 hover:dark:bg-slate-700"
                  aria-label="Refine overall summary"
                  disabled={currentAiOutput.isErrorState}
                >
                  <Edit3 className="h-4 w-4 mr-1" /> Refine
                </Button>
              </div>
              <p className="text-sm text-foreground/90 dark:text-slate-200 whitespace-pre-wrap">
                {currentAiOutput.overallSummary}
              </p>
            </div>
          )}

          {currentAiOutput.draftedResponses && currentAiOutput.draftedResponses.length > 0 && (
            <section>
              <h3 className="text-lg font-semibold text-foreground dark:text-dark-foreground mb-2 flex items-center">
                <Sparkles className="mr-2 h-5 w-5 text-green-500" /> Drafted Responses
              </h3>
              <DraftedResponsesDisplay 
                responses={currentAiOutput.draftedResponses} 
                openRefinementModal={openRefinementModal} 
                createSnippetUpdater={createSnippetUpdater}
                isDisabled={currentAiOutput.isErrorState}
              />
            </section>
          )}

          {currentAiOutput.identifiedObjections && currentAiOutput.identifiedObjections.length > 0 && (
            <section>
              <h3 className="text-lg font-semibold text-foreground dark:text-dark-foreground mb-2 flex items-center">
                <FileWarning className="mr-2 h-5 w-5 text-orange-500" /> Identified Objections
              </h3>
              <IdentifiedObjectionsDisplay objections={currentAiOutput.identifiedObjections} isDisabled={currentAiOutput.isErrorState} />
            </section>
          )}
          
          {currentAiOutput.keyExcerpts && currentAiOutput.keyExcerpts.length > 0 && (
              <section>
                  <h3 className="text-lg font-semibold text-foreground dark:text-dark-foreground mb-2 flex items-center">
                      <Sparkles className="mr-2 h-5 w-5 text-blue-500" /> Key Excerpts
                  </h3>
                  <KeyExcerptsDisplay excerpts={currentAiOutput.keyExcerpts} documentsMap={documentsMap} isDisabled={currentAiOutput.isErrorState} />
              </section>
          )}

          {currentAiOutput.suggestedRequestsForAdmission && currentAiOutput.suggestedRequestsForAdmission.length > 0 && (
            <section>
               <SimpleListDisplay title="Suggested Requests for Admission" items={currentAiOutput.suggestedRequestsForAdmission} iconType="requestsForAdmission" isDisabled={currentAiOutput.isErrorState}/>
            </section>
          )}
          
          {currentAiOutput.suggestedInterrogatories && currentAiOutput.suggestedInterrogatories.length > 0 && (
            <section>
               <SimpleListDisplay title="Suggested Interrogatories" items={currentAiOutput.suggestedInterrogatories} iconType="interrogatories" isDisabled={currentAiOutput.isErrorState}/>
            </section>
          )}

          {currentAiOutput.suggestedRequestsForProduction && currentAiOutput.suggestedRequestsForProduction.length > 0 && (
            <section>
               <SimpleListDisplay title="Suggested Requests for Production" items={currentAiOutput.suggestedRequestsForProduction} iconType="requestsForProduction" isDisabled={currentAiOutput.isErrorState}/>
            </section>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t dark:border-slate-700/50">
              <SimpleListDisplay title="Potential Issues / Risks" items={currentAiOutput.potentialIssues} iconType="potentialIssues" isDisabled={currentAiOutput.isErrorState}/>
              <SimpleListDisplay title="Suggested Next Steps" items={currentAiOutput.suggestedNextSteps} iconType="suggestedSteps" isDisabled={currentAiOutput.isErrorState}/>
          </div>

          {error && isRefinementModalOpen && (
             <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Snippet Refinement Error</AlertTitle>
                <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}

          {currentAiOutput.rawAIOutput && (primaryGoal.toLowerCase().includes("debug raw") || currentAiOutput.isErrorState) && (
            <details className="w-full mt-4 text-left pt-4 border-t dark:border-slate-700/50">
              <summary className="text-xs text-muted-foreground dark:text-slate-400 cursor-pointer hover:text-primary">Show Raw AI Output / Error</summary>
              <ScrollArea className="h-40 mt-1 border dark:border-slate-600 rounded-md p-2 bg-background dark:bg-slate-800">
                <pre className="text-xs whitespace-pre-wrap break-all">{currentAiOutput.rawAIOutput}</pre>
              </ScrollArea>
            </details>
          )}
        </CardContent>
      </Card>
      {isRefinementModalOpen && textToRefine !== null && (
        <RefinementModal
          isOpen={isRefinementModalOpen}
          onClose={closeRefinementModal}
          originalText={textToRefine}
          onSubmit={submitRefinement}
        />
      )}
    </>
  );
};

export default CopilotOutputDisplay; 