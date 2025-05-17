import React, { useState } from 'react';
import { RisksResult, Risk } from '@/services/documentAnalysisService';
import { ShieldAlert, AlertTriangle, ShieldCheck, ShieldQuestion, Copy, MessageSquarePlus, ChevronDown, ChevronUp, Check } from 'lucide-react'; // Icons for severity and Chevrons
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';

interface RisksDisplayProps {
  result: RisksResult;
  onCopyItem: (text: string, itemName?: string) => void;
  onAddItemToContext: (itemText: string, itemTypeLabel: string) => void;
  // onRiskHover: (risk: Risk | null) => void;
  // onRiskClick: (risk: Risk) => void;
  onItemHover: (item: Risk | null) => void;
  onItemClick: (item: Risk) => void;
}

const getRiskSeverityIcon = (severity: Risk['severity']) => {
  switch (severity?.toLowerCase()) {
    case 'critical': return <AlertTriangle className="h-5 w-5 text-destructive dark:text-dark-destructive flex-shrink-0" />;
    case 'high': return <ShieldAlert className="h-5 w-5 text-warning dark:text-dark-warning flex-shrink-0" />;
    case 'medium': return <ShieldCheck className="h-5 w-5 text-info dark:text-dark-info flex-shrink-0" />;
    case 'low': return <ShieldQuestion className="h-5 w-5 text-success dark:text-dark-success flex-shrink-0" />;
    default: return <ShieldQuestion className="h-5 w-5 text-muted-foreground dark:text-dark-muted-foreground flex-shrink-0" />;
  }
};

const getRiskSeverityStyles = (severity: Risk['severity']) => {
  const s = severity?.toLowerCase();
  switch (s) {
    case 'critical': return { 
      borderColorClass: 'border-destructive dark:border-dark-destructive',
      bgColorClass: 'bg-destructive/10 dark:bg-dark-destructive/20',
      badgeVariant: 'destructive' as const,
      textColorClass: 'text-destructive dark:text-dark-destructive'
    };
    case 'high': return { 
      borderColorClass: 'border-warning dark:border-dark-warning',
      bgColorClass: 'bg-warning/10 dark:bg-dark-warning/20',
      badgeVariant: 'warning' as const, 
      textColorClass: 'text-warning dark:text-dark-warning'
    };
    case 'medium': return { 
      borderColorClass: 'border-info dark:border-dark-info',
      bgColorClass: 'bg-info/10 dark:bg-dark-info/20',
      badgeVariant: 'info' as const, 
      textColorClass: 'text-info dark:text-dark-info'
    };
    case 'low': return { 
      borderColorClass: 'border-success dark:border-dark-success',
      bgColorClass: 'bg-success/10 dark:bg-dark-success/20',
      badgeVariant: 'success' as const, 
      textColorClass: 'text-success dark:text-dark-success'
    };
    default: return { 
      borderColorClass: 'border-border dark:border-dark-border',
      bgColorClass: 'bg-muted/50 dark:bg-dark-muted/50',
      badgeVariant: 'default' as const,
      textColorClass: 'text-muted-foreground dark:text-dark-muted-foreground'
    };
  }
};

interface RiskItemProps {
  risk: Risk;
  index: number;
  onCopyItem: (text: string, itemName?: string) => void;
  onAddItemToContext: (itemText: string, itemTypeLabel: string) => void;
  onItemHover: (item: Risk | null) => void;
  onItemClick: (item: Risk) => void;
}

const RiskItem: React.FC<RiskItemProps> = ({ risk, index, onCopyItem, onAddItemToContext, onItemHover, onItemClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const riskTitle = risk.title || `Risk ${index + 1}`;
  const riskTextForActions = `${risk.severity || 'Unknown'} Risk: ${riskTitle} - ${risk.explanation}`;
  const { borderColorClass, bgColorClass, badgeVariant, textColorClass } = getRiskSeverityStyles(risk.severity);

  const toggleExpansion = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  let isExplanationLong = false;
  if (risk.explanation) {
    const lineCount = risk.explanation.split('\n').length;
    if (lineCount > 2) { // 3 or more explicit lines
      isExplanationLong = true;
    } else { // 1 or 2 explicit lines
      isExplanationLong = risk.explanation.length > 100; // Check char length if few explicit lines
    }
  }

  return (
    <div 
      key={index} 
      className={cn(
        "p-3 border-l-4 rounded-md group hover:shadow-lg transition-all duration-150 cursor-pointer",
        borderColorClass,
        bgColorClass // Enabled background color
      )}
      onMouseEnter={() => onItemHover(risk)}
      onMouseLeave={() => onItemHover(null)}
      onClick={() => onItemClick(risk)}
    >
      <div className="flex items-start justify-between mb-1">
        <div className={cn("flex items-center", textColorClass)}>
          {getRiskSeverityIcon(risk.severity)}
          <h5 className="ml-2 font-semibold text-sm">{riskTitle}</h5>
        </div>
        <Badge variant={badgeVariant} className={cn("text-xs whitespace-nowrap")}>
          {risk.severity || 'Unknown'}
        </Badge>
      </div>
      
      <div className="ml-7"> {/* Container for explanation and its toggle */}
        <p className={cn("text-xs text-muted-foreground dark:text-dark-muted-foreground", !isExpanded && "line-clamp-2")} title={!isExpanded ? risk.explanation : undefined}>
            {risk.explanation}
        </p>
        {isExplanationLong && (
            <Button 
                variant="link" 
                size="xs"
                onClick={toggleExpansion} 
                className="h-auto p-0 mt-1 text-xs text-primary dark:text-dark-primary hover:text-primary/80 dark:hover:text-dark-primary/80"
            >
                {isExpanded ? <ChevronUp className="h-3 w-3 mr-0.5"/> : <ChevronDown className="h-3 w-3 mr-0.5"/>}
                {isExpanded ? 'Show less' : 'Show more'}
            </Button>
        )}
      </div>

      <div className="flex items-center space-x-1 mt-2 ml-7 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button 
              variant="ghost" 
              size="xs-icon" 
              className="h-6 w-6 p-1 text-muted-foreground dark:text-dark-muted-foreground hover:text-foreground dark:hover:text-dark-foreground" 
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(riskTextForActions).then(() => { setCopiedIndex(index); toast.success('Copied!'); setTimeout(() => setCopiedIndex(null), 1200); }); }}
              title="Copy Risk Details"
          >
              {copiedIndex === index ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          {copiedIndex === index && <span className="ml-1 text-xs text-green-600">Copied!</span>}
          <Button 
              variant="ghost" 
              size="xs-icon" 
              className="h-6 w-6 p-1 text-muted-foreground dark:text-dark-muted-foreground hover:text-foreground dark:hover:text-dark-foreground" 
              onClick={(e) => { e.stopPropagation(); onAddItemToContext(riskTextForActions, `Risk - ${riskTitle}`); }}
              title="Add Risk to Chat Context"
          >
              <MessageSquarePlus className="h-3.5 w-3.5" /> {/* Standardized icon size */}
          </Button>
      </div>
    </div>
  );
};

const RisksDisplay: React.FC<RisksDisplayProps> = ({ result, onCopyItem, onAddItemToContext, onItemHover, onItemClick }) => {
  if (!result || !result.risks || result.risks.length === 0) {
    return (
        <div className="space-y-3">
             <div className="flex items-center text-base font-semibold text-foreground dark:text-dark-foreground">
                <ShieldAlert className="h-5 w-5 mr-2 text-muted-foreground dark:text-dark-muted-foreground flex-shrink-0" />
                Identified Risks
            </div>
            <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground p-2">No risks identified.</p>
        </div>
    );
  }

  return (
    <div className="space-y-3">
        <div className="flex items-center text-base font-semibold text-foreground dark:text-dark-foreground mb-1">
            <ShieldAlert className="h-5 w-5 mr-2 text-muted-foreground dark:text-dark-muted-foreground flex-shrink-0" />
            Identified Risks
        </div>
        <div className="space-y-2.5">
            {result.risks.map((risk, index) => (
                <RiskItem 
                    key={index} 
                    risk={risk} 
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

export default RisksDisplay; 