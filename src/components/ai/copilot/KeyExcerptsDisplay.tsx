import React from 'react';
import { AIKeyExcerpt } from '@/types/aiCopilot';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FileText } from 'lucide-react';

interface KeyExcerptsDisplayProps {
  excerpts: AIKeyExcerpt[];
  documentsMap: Map<string, { filename: string; title?: string; }>; // To get filename from documentId
}

const KeyExcerptsDisplay: React.FC<KeyExcerptsDisplayProps> = ({ excerpts, documentsMap }) => {
  if (!excerpts || excerpts.length === 0) {
    return <p className="text-sm text-muted-foreground dark:text-slate-400 italic">No key excerpts identified by the AI.</p>;
  }

  return (
    <div className="space-y-3">
      <Accordion type="multiple" className="w-full space-y-2">
        {excerpts.map((item, index) => {
          const docInfo = documentsMap.get(item.documentId);
          const docName = docInfo?.filename || item.documentId; // Fallback to ID if not found
          return (
            <AccordionItem value={`excerpt-${index}`} key={`excerpt-${index}`} className="border dark:border-slate-700 rounded-md bg-background dark:bg-slate-800/30 shadow-sm">
              <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline hover:bg-muted/50 dark:hover:bg-slate-700/50 rounded-t-md">
                <div className="flex items-center space-x-2 w-full">
                  <FileText className="h-4 w-4 text-muted-foreground dark:text-slate-400 flex-shrink-0" />
                  <span className="truncate flex-1 text-left text-foreground dark:text-dark-foreground">
                    Excerpt from: {docName}
                  </span>
                  {item.pageNumber && (
                    <span className="text-xs text-muted-foreground dark:text-slate-400 ml-auto mr-2 whitespace-nowrap">Pg. {item.pageNumber}</span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pt-2 pb-3 border-t dark:border-slate-700 bg-background dark:bg-slate-800/20 rounded-b-md">
                {item.relevanceScore && (
                  <p className="text-xs text-muted-foreground dark:text-slate-400 mb-1.5 italic">
                    Relevance Score: {item.relevanceScore.toFixed(2)}
                  </p>
                )}
                <blockquote className="text-sm text-foreground dark:text-dark-foreground border-l-4 border-primary pl-3 py-1 bg-primary/5 dark:bg-primary/10">
                  {item.text}
                </blockquote>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};

export default KeyExcerptsDisplay; 