import React, { useState } from 'react';
import { ClausesResult, Clause } from '@/services/documentAnalysisService';
import { ListChecks, FileText, MessageSquareText, Copy, MessageSquarePlus, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';

interface ClauseItemProps {
  clause: Clause;
  index: number;
  onCopyItem: (text: string, itemName?: string) => void;
  onAddItemToContext: (itemText: string, itemTypeLabel: string) => void;
  onItemHover: (item: Clause | null) => void;
  onItemClick: (item: Clause) => void;
}

const ClauseItem: React.FC<ClauseItemProps> = ({ clause, index, onCopyItem, onAddItemToContext, onItemHover, onItemClick }) => {
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const clauseTitle = clause.title || `Clause ${index + 1}`;
  const fullClauseTextForContext = 
`${clauseTitle}\n\nExtracted Text:\n${clause.text || 'N/A'}\n\nAI Analysis:\n${clause.analysis || 'N/A'}`;

  const toggleTextExpansion = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsTextExpanded(!isTextExpanded);
  };

  const toggleAnalysisExpansion = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAnalysisExpanded(!isAnalysisExpanded);
  };

  // Determine if text/analysis is long enough to warrant expansion toggle
  const isTextLong = clause.text && clause.text.split('\n').length > 3 || (clause.text && clause.text.length > 200);
  const isAnalysisLong = clause.analysis && clause.analysis.split('\n').length > 3 || (clause.analysis && clause.analysis.length > 200);

  return (
    <div 
      key={index} 
      className="p-3 border border-card-border dark:border-dark-card-border rounded-md bg-card dark:bg-dark-card group hover:shadow-lg dark:hover:shadow-dark-lg hover:bg-card/80 dark:hover:bg-dark-card/80 backdrop-blur-sm transition-all duration-150 cursor-pointer"
      onMouseEnter={() => onItemHover(clause)}
      onMouseLeave={() => onItemHover(null)}
      onClick={() => onItemClick(clause)}
    >
      <div className="flex justify-between items-start mb-2">
          <h5 className="font-semibold text-sm text-primary dark:text-dark-primary flex-grow mr-2" title={clause.title}>
              {clauseTitle}
          </h5>
          <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <Button 
                  variant="ghost" 
                  size="xs-icon" 
                  className="h-6 w-6 p-1 text-muted-foreground dark:text-dark-muted-foreground hover:text-foreground dark:hover:text-dark-foreground"
                  onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(clause.text || 'No text to copy').then(() => { setCopied(true); toast.success('Copied!'); setTimeout(() => setCopied(false), 1200); }); }}
                  title="Copy Clause Text"
              >
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              {copied && <span className="ml-1 text-xs text-green-600">Copied!</span>}
              <Button 
                  variant="ghost" 
                  size="xs-icon" 
                  className="h-6 w-6 p-1 text-muted-foreground dark:text-dark-muted-foreground hover:text-foreground dark:hover:text-dark-foreground"
                  onClick={(e) => { e.stopPropagation(); onAddItemToContext(fullClauseTextForContext, `Clause - ${clauseTitle}`); }}
                  title="Add Clause to Chat Context"
              >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
              </Button>
          </div>
      </div>
      
      {clause.text && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground mb-0.5">
            <div className="flex items-center">
              <FileText className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
              Extracted Text:
            </div>
            {isTextLong && (
              <Button variant="link" size="xs" onClick={toggleTextExpansion} className="h-auto p-0 text-xs text-primary dark:text-dark-primary hover:text-primary/80 dark:hover:text-dark-primary/80">
                {isTextExpanded ? <ChevronUp className="h-3 w-3 mr-0.5"/> : <ChevronDown className="h-3 w-3 mr-0.5"/>}
                {isTextExpanded ? 'Show less' : 'Show more'}
              </Button>
            )}
          </div>
          <p className={cn("text-xs text-muted-foreground dark:text-dark-muted-foreground pl-5", !isTextExpanded && "line-clamp-3")} title={!isTextExpanded ? clause.text : undefined}>
            {clause.text}
          </p>
        </div>
      )}
      {clause.analysis && (
          <div>
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground mb-0.5">
            <div className="flex items-center">
              <MessageSquareText className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
              AI Analysis:
            </div>
            {isAnalysisLong && (
              <Button variant="link" size="xs" onClick={toggleAnalysisExpansion} className="h-auto p-0 text-xs text-primary dark:text-dark-primary hover:text-primary/80 dark:hover:text-dark-primary/80">
                {isAnalysisExpanded ? <ChevronUp className="h-3 w-3 mr-0.5"/> : <ChevronDown className="h-3 w-3 mr-0.5"/>}
                {isAnalysisExpanded ? 'Show less' : 'Show more'}
              </Button>
            )}
          </div>
          <p className={cn("text-xs text-muted-foreground dark:text-dark-muted-foreground pl-5", !isAnalysisExpanded && "line-clamp-3")} title={!isAnalysisExpanded ? clause.analysis : undefined}>
            {clause.analysis}
          </p>
        </div>
      )}
    </div>
  );
};

interface ClausesDisplayProps {
  result: ClausesResult;
  onCopyItem: (text: string, itemName?: string) => void;
  onAddItemToContext: (itemText: string, itemTypeLabel: string) => void;
  // Optional interaction props
  // onClauseHover: (clause: Clause | null) => void;
  // onClauseClick: (clause: Clause) => void;
  onItemHover: (item: Clause | null) => void;
  onItemClick: (item: Clause) => void;
}

const ClausesDisplay: React.FC<ClausesDisplayProps> = ({ result, onCopyItem, onAddItemToContext, onItemHover, onItemClick }) => {
  if (!result || !result.clauses || result.clauses.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center text-base font-semibold text-foreground dark:text-dark-foreground">
          <ListChecks className="h-5 w-5 mr-2 text-primary dark:text-dark-primary flex-shrink-0" />
          Key Clauses
        </div>
        <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground p-2">No key clauses identified.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center text-base font-semibold text-foreground dark:text-dark-foreground">
        <ListChecks className="h-5 w-5 mr-2 text-primary dark:text-dark-primary flex-shrink-0" />
        Key Clauses
      </div>
      <div className="space-y-3">
        {result.clauses.map((clause, index) => (
          <ClauseItem 
            key={index} 
            clause={clause} 
            index={index} 
            onCopyItem={onCopyItem} 
            onAddItemToContext={onAddItemToContext} 
            onItemHover={onItemHover} 
            onItemClick={onItemClick} 
          />
        ))}
      </div>
    </div>
  );
};

export default ClausesDisplay; 