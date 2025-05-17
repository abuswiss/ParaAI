import React, { useState } from 'react';
import { PositionalItem } from '@/services/documentAnalysisService'; // Base for start/end
import { ShieldCheck, Gavel, Copy, MessageSquarePlus, ChevronDown, ChevronUp, Check } from 'lucide-react'; // Updated Gavel to ShieldCheck for privileged terms, added Chevrons and Check
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';

// Assumed structure based on AnalysisType 'privilegedTerms'
interface PrivilegedTerm extends PositionalItem {
    term: string;
    category: string; // e.g., Attorney-Client, Work Product
    explanation?: string;
}

// The result prop might be an object with a privilegedTerms key, or the array directly.
// Let's assume it can be { privilegedTerms: PrivilegedTerm[] } based on common patterns.
interface PrivilegedTermsResultShape {
    privilegedTerms: PrivilegedTerm[];
}

interface PrivilegedTermItemProps {
    termItem: PrivilegedTerm; // Renamed from term to termItem to avoid conflict with term.term
    index: number;
    onCopyItem: (text: string, itemName?: string) => void;
    onAddItemToContext: (itemText: string, itemTypeLabel: string) => void;
    onItemHover: (item: PrivilegedTerm | null) => void;
    onItemClick: (item: PrivilegedTerm) => void;
}

const PrivilegedTermItem: React.FC<PrivilegedTermItemProps> = ({ termItem, index, onCopyItem, onAddItemToContext, onItemHover, onItemClick }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    
    const termTitle = termItem.term || `Term ${index + 1}`;
    const termTextForActions = `${termTitle} (${termItem.category})${termItem.explanation ? `: ${termItem.explanation}` : ''}`;

    const toggleExpansion = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    const isExplanationLong = termItem.explanation && (termItem.explanation.split('\n').length > 2 || termItem.explanation.length > 150);

    return (
        <div 
            key={index} 
            className="p-3 border border-card-border dark:border-dark-card-border rounded-md bg-card dark:bg-dark-card group hover:shadow-lg dark:hover:shadow-dark-lg hover:bg-card/80 dark:hover:bg-dark-card/80 backdrop-blur-sm transition-all duration-150 cursor-pointer"
            onMouseEnter={() => onItemHover(termItem)}
            onMouseLeave={() => onItemHover(null)}
            onClick={() => onItemClick(termItem)}
        >
            <div className="flex items-start justify-between mb-1">
            <div className="flex-1 min-w-0 mr-2">
                <span className="font-semibold text-sm text-primary dark:text-dark-primary flex items-center" title={termItem.term}>
                    <Gavel className="h-4 w-4 mr-1.5 flex-shrink-0"/> 
                    {termItem.term}
                </span>
            </div>
            <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <Button 
                    variant="ghost" 
                    size="xs-icon" 
                    className="h-6 w-6 p-1 text-muted-foreground dark:text-dark-muted-foreground hover:text-foreground dark:hover:text-dark-foreground"
                    onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(termItem.term).then(() => { setCopiedIndex(index); toast.success('Copied!'); setTimeout(() => setCopiedIndex(null), 1200); }); }}
                    title="Copy Term"
                >
                    {copiedIndex === index ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                {copiedIndex === index && <span className="ml-1 text-xs text-green-600">Copied!</span>}
                <Button 
                    variant="ghost" 
                    size="xs-icon" 
                    className="h-6 w-6 p-1 text-muted-foreground dark:text-dark-muted-foreground hover:text-foreground dark:hover:text-dark-foreground"
                    onClick={(e) => { e.stopPropagation(); onAddItemToContext(termTextForActions, `Privileged Term - ${termItem.term}`); }}
                    title="Add Term to Chat Context"
                >
                    <MessageSquarePlus className="h-3.5 w-3.5" />
                </Button>
            </div>
            </div>
            
            <div className="flex items-center justify-start space-x-2 mb-1.5 ml-[calc(1rem+0.375rem)]">
                {termItem.category && (
                    <Badge variant="outline" className="text-xs whitespace-nowrap border-primary text-primary dark:border-dark-primary dark:text-dark-primary">
                        {termItem.category}
                    </Badge>
                )}
            </div>

            {termItem.explanation && (
                <div className="ml-[calc(1rem+0.375rem)]"> {/* Container for explanation and its toggle */}
                    <p className={cn("text-xs text-muted-foreground dark:text-dark-muted-foreground mt-1", !isExpanded && "line-clamp-2")} title={!isExpanded ? termItem.explanation : undefined}>
                    {termItem.explanation}
                    </p>
                    {isExplanationLong && (
                        <Button 
                            variant="link" 
                            size="xs"
                            onClick={toggleExpansion} 
                            className="h-auto p-0 mt-0.5 text-xs text-primary dark:text-dark-primary hover:text-primary/80 dark:hover:text-dark-primary/80"
                        >
                            {isExpanded ? <ChevronUp className="h-3 w-3 mr-0.5"/> : <ChevronDown className="h-3 w-3 mr-0.5"/>}
                            {isExpanded ? 'Show less' : 'Show more'}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
};

interface PrivilegedTermsDisplayProps {
  result: PrivilegedTermsResultShape | PrivilegedTerm[];
  onCopyItem: (text: string, itemName?: string) => void;
  onAddItemToContext: (itemText: string, itemTypeLabel: string) => void;
  onItemHover: (item: PrivilegedTerm | null) => void;
  onItemClick: (item: PrivilegedTerm) => void;
}

const PrivilegedTermsDisplay: React.FC<PrivilegedTermsDisplayProps> = ({ result, onCopyItem, onAddItemToContext, onItemHover, onItemClick }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const termsArray = Array.isArray(result) ? result : result?.privilegedTerms;

  if (!Array.isArray(termsArray) || termsArray.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center text-base font-semibold text-foreground dark:text-dark-foreground">
          <ShieldCheck className="h-5 w-5 mr-2 text-primary dark:text-dark-primary flex-shrink-0" />
          Privileged Terms
        </div>
        <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground p-2">No privileged terms identified.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center text-base font-semibold text-foreground dark:text-dark-foreground">
        <ShieldCheck className="h-5 w-5 mr-2 text-primary dark:text-dark-primary flex-shrink-0" />
        Privileged Terms
      </div>
      <div className="space-y-2">
        {termsArray.map((term: PrivilegedTerm, index: number) => (
          <PrivilegedTermItem 
            key={index} 
            termItem={term} 
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

export default PrivilegedTermsDisplay; 