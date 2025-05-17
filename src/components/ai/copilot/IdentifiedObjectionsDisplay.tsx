import React from 'react';
import { AIIdentifiedObjection } from '@/types/aiCopilot';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertTriangle, FileText } from 'lucide-react';

interface IdentifiedObjectionsDisplayProps {
  objections: AIIdentifiedObjection[];
}

const IdentifiedObjectionsDisplay: React.FC<IdentifiedObjectionsDisplayProps> = ({ objections }) => {
  if (!objections || objections.length === 0) {
    return <p className="text-sm text-muted-foreground dark:text-slate-400 italic">No specific objections identified by the AI for this goal.</p>;
  }

  return (
    <div className="space-y-4">
      <Accordion type="multiple" className="w-full space-y-3">
        {objections.map((item, index) => (
          <AccordionItem value={`objection-${index}`} key={`objection-${index}`} className="border dark:border-slate-700 rounded-md bg-background dark:bg-slate-800/30 shadow-sm">
            <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline hover:bg-muted/50 dark:hover:bg-slate-700/50 rounded-t-md">
              <div className="flex items-center space-x-2 w-full">
                <AlertTriangle className="h-4 w-4 text-orange-500 dark:text-orange-400 flex-shrink-0" />
                <span className="truncate flex-1 text-left text-foreground dark:text-dark-foreground">
                  Objection: {item.objection}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pt-3 pb-4 border-t dark:border-slate-700 bg-background dark:bg-slate-800/20 rounded-b-md space-y-3">
              <div>
                <h5 className="text-xs font-semibold text-muted-foreground dark:text-slate-400 mb-1">Explanation:</h5>
                <p className="text-sm text-foreground dark:text-dark-foreground p-2 bg-muted/30 dark:bg-slate-700/30 rounded-sm">
                  {item.explanation}
                </p>
              </div>

              {item.supportingExcerpts && item.supportingExcerpts.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold text-muted-foreground dark:text-slate-400 mb-1 flex items-center">
                    <FileText className="h-3.5 w-3.5 mr-1.5 text-blue-500" /> Supporting Excerpts:
                  </h5>
                  <ul className="space-y-1.5 pl-1">
                    {item.supportingExcerpts.map((supExc, supIdx) => (
                      <li key={supIdx} className="text-xs border-l-2 border-primary/50 pl-2 py-1 bg-muted/20 dark:bg-slate-700/20 rounded-r-sm">
                        <span className="font-medium text-muted-foreground dark:text-slate-400">From {supExc.sourceFilename}:</span> \
                        <span className="italic text-foreground/80 dark:text-slate-300"> "{supExc.text}"</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

export default IdentifiedObjectionsDisplay; 