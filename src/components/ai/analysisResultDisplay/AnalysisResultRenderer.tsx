import React from 'react';
import { AnalysisType, StructuredAnalysisResult, EntitiesResult, ClausesResult, RisksResult, TimelineResult, AnalysisErrorResult } from '@/services/documentAnalysisService';

import {
  SummaryDisplay,
  EntitiesDisplay,
  ClausesDisplay,
  RisksDisplay,
  TimelineDisplay,
  PrivilegedTermsDisplay,
} from './index'; // Import from the new index file

// Placeholder for specific display components - these will be created next
// import SummaryDisplay from './SummaryDisplay';
// import EntitiesDisplay from './EntitiesDisplay';
// import ClausesDisplay from './ClausesDisplay';
// import RisksDisplay from './RisksDisplay';
// import TimelineDisplay from './TimelineDisplay';
// import PrivilegedTermsDisplay from './PrivilegedTermsDisplay';
// import DefaultDisplay from './DefaultDisplay';

interface AnalysisResultRendererProps {
  analysisType: AnalysisType | null;
  analysisResult: StructuredAnalysisResult | null;
  onCopyItemText: (text: string, itemName?: string) => void;
  onAddItemToChatContext: (itemText: string, itemTypeLabel: string) => void;
  // Add interaction props later - pass them down from parent module
  // onItemHover: (item: any | null) => void;
  // onItemClick: (item: any) => void;
  onItemHover: (item: PositionalItem | null) => void;
  onItemClick: (item: PositionalItem) => void;
}

const AnalysisResultRenderer: React.FC<AnalysisResultRendererProps> = ({
  analysisType,
  analysisResult,
  onCopyItemText,
  onAddItemToChatContext,
  // onItemHover, // Receive interaction props
  // onItemClick,
  onItemHover,
  onItemClick,
}) => {
  if (!analysisType || !analysisResult) {
    return <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground">No analysis result to display.</p>;
  }

  // Handle string results (likely Summary)
  if (typeof analysisResult === 'string') {
    if (analysisType === 'summary') {
      return <SummaryDisplay result={analysisResult} />;
    }
    // Render other string results as plain text
    return <p className="text-xs whitespace-pre-wrap break-words text-foreground dark:text-dark-foreground">{analysisResult}</p>; 
  }

  // Type guard for AnalysisErrorResult
  if (analysisResult && typeof analysisResult === 'object' && 'error' in analysisResult && analysisResult.error) {
    const errorResult = analysisResult as AnalysisErrorResult;
    return (
      <div className="text-destructive dark:text-dark-destructive text-sm">
        <p><strong>Error in analysis:</strong> {errorResult.error}</p>
        {errorResult.rawResponse && (
          <details className="mt-2 text-xs">
            <summary className="text-muted-foreground dark:text-dark-muted-foreground cursor-pointer">Show raw response</summary>
            <pre className="whitespace-pre-wrap break-words bg-muted dark:bg-dark-muted text-foreground dark:text-dark-foreground p-2 rounded mt-1">
              {errorResult.rawResponse}
            </pre>
          </details>
        )}
      </div>
    );
  }

  // Render based on analysis type
  switch (analysisType) {
    case 'summary':
      // SummaryDisplay usually shows the whole summary, item actions might not be typical here
      // or would apply to the whole summary. For now, not passing item-specific handlers.
      if (typeof analysisResult === 'string') {
        return <SummaryDisplay result={analysisResult} />;
      } 
      if (typeof (analysisResult as any)?.summary === 'string') {
        return <SummaryDisplay result={analysisResult as { summary: string }} />;
      }
      return <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground">Summary format not recognized.</p>;

    case 'entities':
      if (analysisResult && typeof analysisResult === 'object' && 'entities' in analysisResult && Array.isArray((analysisResult as EntitiesResult).entities)) {
        return <EntitiesDisplay result={analysisResult as EntitiesResult} onCopyItem={onCopyItemText} onAddItemToContext={onAddItemToChatContext} onItemHover={onItemHover} onItemClick={onItemClick} />;
      }
      break;

    case 'clauses':
      if (analysisResult && typeof analysisResult === 'object' && 'clauses' in analysisResult && Array.isArray((analysisResult as ClausesResult).clauses)) {
        return <ClausesDisplay result={analysisResult as ClausesResult} onCopyItem={onCopyItemText} onAddItemToContext={onAddItemToChatContext} onItemHover={onItemHover} onItemClick={onItemClick} />;
      }
      break;

    case 'risks':
      if (analysisResult && typeof analysisResult === 'object' && 'risks' in analysisResult && Array.isArray((analysisResult as RisksResult).risks)) {
        return <RisksDisplay result={analysisResult as RisksResult} onCopyItem={onCopyItemText} onAddItemToContext={onAddItemToChatContext} onItemHover={onItemHover} onItemClick={onItemClick} />;
      }
      break;

    case 'timeline':
      if (analysisResult && typeof analysisResult === 'object' && 'timeline' in analysisResult && Array.isArray((analysisResult as TimelineResult).timeline)) {
        return <TimelineDisplay result={analysisResult as TimelineResult} onCopyItem={onCopyItemText} onAddItemToContext={onAddItemToChatContext} onItemHover={onItemHover} onItemClick={onItemClick} />;
      }
      break;

    case 'privilegedTerms':
      if (analysisResult && typeof analysisResult === 'object' && 'privilegedTerms' in analysisResult && Array.isArray((analysisResult as any).privilegedTerms)) {
        return <PrivilegedTermsDisplay result={analysisResult} onCopyItem={onCopyItemText} onAddItemToContext={onAddItemToChatContext} onItemHover={onItemHover} onItemClick={onItemClick} />;
      }
      break;

    case 'custom':
    case 'document_context':
    default:
      // Fallback for unknown types or structures
      return (
        <div>
          <p className="text-sm font-medium mb-1 text-foreground dark:text-dark-foreground">Unsupported or Custom Analysis Result:</p>
          <pre className="text-xs whitespace-pre-wrap break-words bg-muted dark:bg-dark-muted text-foreground dark:text-dark-foreground p-2 rounded">
            {JSON.stringify(analysisResult, null, 2)}
          </pre>
        </div>
      );
  }

  // Fallback if type guard failed for a known type
  return <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground">Could not render result for {analysisType}.</p>;
};

export default AnalysisResultRenderer; 