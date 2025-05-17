import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { StickyNote, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';

interface SummaryDisplayProps {
  // Summary can be a plain string or an object like { summary: "text" }
  result: string | { summary: string; [key: string]: any };
}

const SummaryDisplay: React.FC<SummaryDisplayProps> = ({ result }) => {
  let summaryText = '';
  const [copied, setCopied] = useState(false);

  if (typeof result === 'string') {
    summaryText = result;
  } else if (result && typeof result.summary === 'string') {
    summaryText = result.summary;
  } else {
    return <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground">Summary format not recognized or summary is empty.</p>;
  }

  if (!summaryText.trim()) {
    return <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground">No summary content available.</p>;
  }

  const handleCopySummary = () => {
    navigator.clipboard.writeText(summaryText)
      .then(() => {
        setCopied(true);
        toast.success('Copied!');
        setTimeout(() => setCopied(false), 1200);
      })
      .catch(err => {
        toast.error('Failed to copy summary.');
        console.error('Failed to copy summary: ', err);
      });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-base font-semibold text-foreground dark:text-dark-foreground">
        <div className="flex items-center">
          <StickyNote className="h-5 w-5 mr-2 text-info dark:text-dark-info flex-shrink-0" />
          Document Summary
        </div>
        <div className="flex items-center space-x-1">
          <Button variant="ghost" size="icon_sm" onClick={handleCopySummary} title="Copy summary">
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground dark:text-dark-muted-foreground hover:text-foreground dark:hover:text-dark-foreground" />}
          </Button>
          {copied && <span className="ml-1 text-xs text-green-600">Copied!</span>}
        </div>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none p-3 border border-card-border dark:border-dark-card-border rounded-md bg-card dark:bg-dark-card backdrop-blur-sm shadow-sm text-card-foreground dark:text-dark-card-foreground">
        <ReactMarkdown
          components={{
            p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
            ul: ({node, ...props}) => <ul className="list-disc list-inside pl-1 mb-2" {...props} />,
            ol: ({node, ...props}) => <ol className="list-decimal list-inside pl-1 mb-2" {...props} />,
            li: ({node, ...props}) => <li className="mb-1" {...props} />,
            strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
            em: ({node, ...props}) => <em className="italic" {...props} />,
            h1: ({node, ...props}) => <h1 className="text-lg font-semibold mt-3 mb-1.5 text-card-foreground dark:text-dark-card-foreground" {...props} />,
            h2: ({node, ...props}) => <h2 className="text-base font-semibold mt-2.5 mb-1 text-card-foreground dark:text-dark-card-foreground" {...props} />,
            h3: ({node, ...props}) => <h3 className="text-sm font-semibold mt-2 mb-0.5 text-card-foreground dark:text-dark-card-foreground" {...props} />,
            a: ({node, ...props}) => <a className="text-primary dark:text-dark-primary hover:underline" {...props} />
          }}
        >
          {summaryText}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default SummaryDisplay; 