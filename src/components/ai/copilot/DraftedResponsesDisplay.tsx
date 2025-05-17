import React from 'react';
import { AIAnalysisResults, AIDraftedResponse, AIKeyExcerpt } from '@/types/aiCopilot';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Edit3, FileText, MessageSquareText, ListChecks } from 'lucide-react';

interface DraftedResponsesDisplayProps {
  responses: AIDraftedResponse[];
  openRefinementModal: (text: string, updater: (refinedText: string) => void) => void;
  createSnippetUpdater: (fieldToUpdate: 'draftedResponses', index: number) => (refinedText: string) => void;
  isDisabled?: boolean;
}

const DraftedResponsesDisplay: React.FC<DraftedResponsesDisplayProps> = ({ responses, openRefinementModal, createSnippetUpdater, isDisabled }) => {

  const handleRefineResponse = (responseIndex: number, currentText: string) => {
    const updater = createSnippetUpdater('draftedResponses', responseIndex);
    openRefinementModal(currentText, updater);
  };

  if (!responses || responses.length === 0) {
    return <p className="text-sm text-muted-foreground">No drafted responses available.</p>;
  }

  return (
    <Accordion type="multiple" className="w-full space-y-3">
      {responses.map((response, index) => (
        <AccordionItem key={index} value={`response-${index}`} className="border dark:border-slate-700 rounded-md shadow-sm bg-card dark:bg-slate-800/50">
          <AccordionTrigger className="p-4 text-left hover:no-underline">
            <div className="flex items-center justify-between w-full">
                <span className="font-medium text-sm text-foreground dark:text-dark-foreground truncate pr-2">
                    {response.responseNumber || `Response ${index + 1}`}
                </span>
                {response.objections && response.objections.length > 0 && (
                    <Badge variant="destructive" className="ml-auto mr-2 whitespace-nowrap">Contains Objections</Badge>
                )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-4 pt-0">
            <div className="relative group mb-3">
                <p className="text-sm text-muted-foreground dark:text-slate-300 mb-1 font-medium flex items-center">
                    <MessageSquareText className="h-4 w-4 mr-2 text-primary"/> Drafted Text
                </p>
                <p className="text-sm text-foreground dark:text-slate-200 whitespace-pre-wrap p-2 border dark:border-slate-600 rounded-md bg-background dark:bg-slate-700/30">
                    {response.draftedText}
                </p>
                {!isDisabled && (
                  <Button 
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRefineResponse(index, response.draftedText)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 right-0 p-1 h-auto text-xs dark:text-slate-300 hover:dark:bg-slate-600"
                      aria-label="Refine drafted text"
                  >
                      <Edit3 className="h-3 w-3 mr-1" /> Refine
                  </Button>
                )}
            </div>

            {response.objections && response.objections.length > 0 && (
              <div className="mb-3">
                <h4 className="text-sm font-medium text-muted-foreground dark:text-slate-300 mb-1 flex items-center">
                    <ListChecks className="h-4 w-4 mr-2 text-destructive"/> Potential Objections
                </h4>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  {response.objections.map((objection, objIndex) => (
                    <li key={objIndex} className="text-xs text-destructive dark:text-red-400/90">{objection}</li>
                  ))}
                </ul>
              </div>
            )}

            {response.supportingExcerpts && response.supportingExcerpts.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground dark:text-slate-300 mb-1 flex items-center">
                    <FileText className="h-4 w-4 mr-2 text-blue-500"/> Supporting Excerpts
                </h4>
                <div className="space-y-1.5">
                  {response.supportingExcerpts.map((excerpt, excerptIndex) => (
                    <div key={excerptIndex} className="text-xs p-2 border dark:border-slate-600 rounded-md bg-muted/30 dark:bg-slate-700/40">
                        <p className="italic text-muted-foreground dark:text-slate-400 truncate" title={excerpt.text}>"{excerpt.text}"</p>
                        <p className="text-right text-muted-foreground/80 dark:text-slate-500 text-[10px] mt-0.5">
                            Source: {excerpt.sourceFilename}
                        </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};

export default DraftedResponsesDisplay; 