import React from 'react';
import { Brain } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SourceInfo } from './LegalSourcesDisplay'; // Assuming this path is correct

// Import UI components from the project's existing UI library
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { processThoughts } from './thoughtProcessor';

interface Thought {
  id: string;
  content: string;
}

interface LegalThinkingPanelProps {
  thoughts: Thought[];
  collapsed?: boolean;
  title?: string;
  isPending?: boolean;
  sources?: SourceInfo[]; // Add sources prop
  // Define customRenderers if passed from parent, or define locally if simple enough
  // For now, we'll assume citation rendering logic will be part of the content passed or handled by a shared utility
}

// Fallback: if processThoughts is not available, just return the input
const fallbackProcessThoughts = (thoughts: Thought[]) => thoughts;

/**
 * A component that displays the legal reasoning/thinking process from Claude
 * Can be used in both collapsed and expanded modes for different UI contexts
 */
const LegalThinkingPanel: React.FC<LegalThinkingPanelProps> = ({
  thoughts,
  collapsed = false,
  title = "Legal Reasoning",
  isPending = false,
  sources
}) => {
  if (!thoughts || thoughts.length === 0) return null;

  // Use the processor if available, fallback otherwise
  const processedThoughts = typeof processThoughts === 'function' ? processThoughts(thoughts) : fallbackProcessThoughts(thoughts);

  if (collapsed) {
    return (
      <div className="mt-3 pt-2 border-t border-dashed border-border dark:border-dark-border">
        <Collapsible>
          <CollapsibleTrigger className="text-xs flex items-center text-primary dark:text-dark-primary hover:opacity-80">
            <Brain className="h-3.5 w-3.5 mr-1.5" />
            View Legal Reasoning ({processedThoughts.length} steps)
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 text-xs">
            <ol className="space-y-1.5 list-decimal pl-5">
              {processedThoughts.map((thought, idx) => (
                <li key={thought.id || idx} className="text-muted-foreground dark:text-dark-muted-foreground">
                  {thought.content.length > 100 ? thought.content.substring(0, 97) + "..." : thought.content}
                </li>
              ))}
            </ol>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  }

  // Modern, clean UI for expanded mode (typically shown during live streaming)
  return (
    <div className="bg-card/50 dark:bg-dark-card/50 backdrop-blur-sm border border-card-border dark:border-dark-card-border rounded-lg p-4 mb-4 w-full">
      <div className="flex items-center mb-3">
        <Brain className="h-5 w-5 text-primary dark:text-dark-primary mr-2" />
        <h3 className="text-sm font-medium text-card-foreground dark:text-dark-card-foreground">
          {isPending ? "Thinking Process" : "Legal Reasoning"} ({processedThoughts.length} steps)
        </h3>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none text-card-foreground dark:text-dark-card-foreground">
        {processedThoughts.map((thought, index) => (
          <div key={thought.id || index} className="mb-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {thought.content}
            </ReactMarkdown>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LegalThinkingPanel;
