import React from 'react';
import {
    // Remove DocumentAnalysisResult import if only using the inner result
    EntitiesResult,
    Entity,
    ClausesResult,
    Clause,
    RisksResult,
    Risk,
    TimelineResult,
    TimelineEvent,
    AnalysisErrorResult,
    StructuredAnalysisResult,
    AnalysisType
} from '@/services/documentAnalysisService'; 
import TimelineView from '../timeline/TimelineView'; 
import { RiskAssessment } from './RiskAssessment'; 
import ReactMarkdown from 'react-markdown';
import { Icons } from '@/components/ui/Icons';
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Card, CardContent } from "@/components/ui/Card"; // Removed unused Header/Title
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion" // Import Accordion components
import { Badge, BadgeVariant } from "@/components/ui/Badge"; // Import Badge for risks/entities
import { cn } from "@/lib/utils"; // Import cn for conditional classes
import { ShieldAlert, CalendarDays, MessageSquarePlus } from 'lucide-react'; // Import icons
import { Button } from "@/components/ui/Button"; // Import Button
import { HighlightPosition } from './DocumentViewer'; // Import HighlightPosition for callback prop

// Add specific type for Summary result
interface SummaryAnalysisResult {
    summary: string;
    summaryAnalysis: string;
}

// Helper to check if the result is the new summary structure
function isSummaryAnalysisResult(result: any): result is SummaryAnalysisResult {
    return typeof result === 'object' && result !== null && 'summary' in result && 'summaryAnalysis' in result;
}

// Removed internal type alias - rely on props

interface DocumentAnalyzerProps {
  // Removed analysisType
  // Accept the direct result data, which can be various types or null
  resultData: StructuredAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  onInitiateChat: (item: any, type: AnalysisType) => void; // Add prop type
  onFindingClick: (position: HighlightPosition | null) => void; // Add callback prop
}

// Removed mock interfaces (Entity, Clause, RiskData) as we use imported types

// Helper function to check if the result is an AnalysisErrorResult
function isAnalysisError(result: StructuredAnalysisResult | null): result is AnalysisErrorResult {
    return typeof result === 'object' && result !== null && 'error' in result && !('entities' in result || 'clauses' in result || 'risks' in result || 'timeline' in result);
}

// Type for Privileged Terms result (matching backend)
interface PrivilegedTerm {
    text: string;
    category: string;
    explanation: string;
    start: number;
    end: number;
}
interface PrivilegedTermsResult {
    privilegedTerms: PrivilegedTerm[];
}
function isPrivilegedTermsResult(result: any): result is PrivilegedTermsResult {
    return typeof result === 'object' && result !== null && Array.isArray(result.privilegedTerms);
}

const DocumentAnalyzer: React.FC<DocumentAnalyzerProps> = ({ 
    resultData, // Use resultData prop
    isLoading, 
    error,
    onInitiateChat, // Destructure prop
    onFindingClick // Destructure prop
}) => {
  
  const renderAnalysisContent = () => {
    // Handle external loading/error first
    if (isLoading) {
      return (
        <div className="space-y-3 p-4">
            <Skeleton className="h-6 w-1/4 rounded" /> 
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-5/6 rounded" />
            <Skeleton className="h-4 w-3/4 rounded" />
        </div>
      );
    }
    // Display external error if present (e.g., function invocation failed)
    if (error) {
      return (
        <div className="p-4">
            <Alert variant="destructive">
                <Icons.Alert className="h-4 w-4" />
                <AlertTitle>Analysis Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        </div>
      );
    }

    // Handle case where no result data is available (yet)
    if (resultData === null || resultData === undefined) {
      return <div className="p-4 text-center text-muted-foreground italic">Select an analysis type to view results.</div>;
    }

    // Handle analysis-specific error reported by the backend
    if (isAnalysisError(resultData)) {
        return (
           <div className="p-4">
                <Alert variant="destructive">
                    <Icons.Alert className="h-4 w-4" />
                    <AlertTitle>Analysis Error</AlertTitle>
                    <AlertDescription>{resultData.error}</AlertDescription>
                    {resultData.rawResponse && (
                        <pre className="mt-2 text-xs whitespace-pre-wrap bg-destructive/10 p-2 rounded">Raw Response: {resultData.rawResponse}</pre>
                    )}
                </Alert>
            </div>
        );
    }

    // Render based on the *type* of resultData received
    // Check for specific SummaryAnalysisResult structure first
    if (isSummaryAnalysisResult(resultData)) {
        // For summary, display the ANALYSIS part in this panel
        return (
            <ScrollArea className="h-[calc(100vh-250px)] p-4">
                <div className="prose prose-sm dark:prose-invert max-w-none relative">
                    <Button 
                        variant="ghost" 
                        size="icon_xs" 
                        className="absolute top-0 right-0 text-muted-foreground hover:text-primary" 
                        onClick={() => onInitiateChat(resultData, 'summary')} // Pass entire summary object
                        title="Discuss this analysis in chat"
                    >
                        <MessageSquarePlus className="h-4 w-4" />
                    </Button>
                    <ReactMarkdown>
                        {resultData.summaryAnalysis} 
                    </ReactMarkdown>
                </div>
            </ScrollArea>
        );
    }
     else if (typeof resultData === 'string') { // Fallback for potentially old summary format or custom string results
        return (
            <ScrollArea className="h-[calc(100vh-250px)] p-4"> 
                <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>
                        {resultData}
                    </ReactMarkdown>
                </div>
            </ScrollArea>
        );
    } else if (typeof resultData === 'object' && 'entities' in resultData) { // Entities
        const entitiesResult = resultData as EntitiesResult;
        const entities = entitiesResult.entities || [];
        if (entities.length === 0) {
            return <div className="p-4 text-muted-foreground italic">No entities found.</div>;
        }
        // Group entities by type
        const groupedEntities = entities.reduce((acc, entity) => {
            (acc[entity.type] = acc[entity.type] || []).push(entity);
            return acc;
        }, {} as Record<string, Entity[]>);

        return (
            <ScrollArea className="h-[calc(100vh-250px)] p-4"> 
                <Accordion type="multiple" className="w-full space-y-2"> {/* Allow multiple open */} 
                    {Object.entries(groupedEntities).map(([type, items]) => (
                        <AccordionItem value={type} key={type} className="border rounded bg-muted/30">
                            <AccordionTrigger 
                                className="p-3 text-sm text-left hover:no-underline space-x-2 cursor-pointer" // Added cursor-pointer
                            >
                                {/* Optional: Add an icon based on type? */} 
                                <span className="font-medium flex-1 text-foreground uppercase tracking-wider text-xs">{type.replace('_', ' ')}</span>
                                <Badge variant="secondary" className="flex-shrink-0">{items.length}</Badge> {/* Show count */} 
                            </AccordionTrigger>
                            <AccordionContent className="p-3 pt-0 text-sm text-foreground bg-background/50 rounded-b">
                                <ul className="list-none space-y-1">
                                    {items.map((entity, index) => (
                                        <li 
                                            key={`${type}-${index}-${entity.start}`}
                                            className="border-b border-border/50 py-1 flex justify-between items-center pr-1 cursor-pointer hover:bg-muted/50 rounded-sm transition-colors"
                                            onClick={() => onFindingClick({ start: entity.start, end: entity.end })} // Added onClick handler
                                            title="Go to entity in document"
                                        >
                                            <span>{entity.text}</span>
                                            <Button 
                                                variant="ghost" size="icon_xs" 
                                                className="text-muted-foreground hover:text-primary flex-shrink-0 ml-2"
                                                onClick={() => onInitiateChat(entity, 'entities')}
                                                title="Discuss this entity in chat"
                                            >
                                                <MessageSquarePlus className="h-3 w-3" />
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </ScrollArea>
        );
    } else if (typeof resultData === 'object' && 'clauses' in resultData) { // Clauses
        const clausesResult = resultData as ClausesResult;
        const clauses = clausesResult.clauses || [];
        if (clauses.length === 0) {
            return <div className="p-4 text-muted-foreground italic">No key clauses identified.</div>;
        }
        return (
            <ScrollArea className="h-[calc(100vh-250px)] p-4"> 
              <Accordion type="single" collapsible className="w-full space-y-2">
                  {clauses.map((clause, index) => (
                      <AccordionItem value={`clause-${index}`} key={`${clause.start}-${index}`} className="border rounded bg-muted/30">
                          <AccordionTrigger 
                                className="p-3 text-sm text-left hover:no-underline cursor-pointer" // Added cursor-pointer
                                onClick={() => onFindingClick({ start: clause.start, end: clause.end })} // Added onClick handler
                                title="Go to clause in document"
                           >
                              <span className="font-medium flex-1 text-foreground">{clause.title || `Clause ${index + 1}`}</span>
                          </AccordionTrigger>
                          <AccordionContent className="p-3 pt-0 text-sm text-foreground space-y-1 bg-background/50 rounded-b relative">
                                <Button 
                                    variant="ghost" size="icon_xs" 
                                    className="absolute top-1 right-1 text-muted-foreground hover:text-primary"
                                    onClick={() => onInitiateChat(clause, 'clauses')}
                                    title="Discuss this clause in chat"
                                >
                                    <MessageSquarePlus className="h-3 w-3" />
                                </Button>
                              {clause.text && <p className="text-muted-foreground text-xs italic mb-2 pr-6">"{clause.text}"</p>}
                              {clause.analysis && <p className="pr-6">{clause.analysis}</p>}
                          </AccordionContent>
                      </AccordionItem>
                  ))}
              </Accordion>
            </ScrollArea>
        );
    } else if (typeof resultData === 'object' && 'risks' in resultData) { // Risks
        const risksResult = resultData as RisksResult;
        const risks = risksResult.risks || [];
        if (risks.length === 0) {
            return <div className="p-4 text-muted-foreground italic">No significant risks identified.</div>;
        }

        const getRiskBadgeVariant = (severity: Risk['severity']): BadgeVariant => {
            switch (severity?.toLowerCase()) {
                case 'high': return 'destructive';
                case 'medium': return 'warning'; // Assuming you have a 'warning' variant
                case 'low': return 'success'; // Assuming you have a 'success' variant
                default: return 'secondary';
            }
        };
        const getRiskIconColor = (severity: Risk['severity']): string => {
            switch (severity?.toLowerCase()) {
                case 'high': return 'text-red-500';
                case 'medium': return 'text-yellow-500';
                case 'low': return 'text-green-500';
                default: return 'text-muted-foreground';
            }
        };

        return (
            <ScrollArea className="h-[calc(100vh-250px)] p-4">
                 <Accordion type="single" collapsible className="w-full space-y-2">
                    {risks.map((risk, index) => (
                        <AccordionItem value={`risk-${index}`} key={`${risk.start}-${index}`} className="border rounded bg-muted/30">
                            <AccordionTrigger 
                                className="p-3 text-sm text-left hover:no-underline space-x-2 cursor-pointer" // Added cursor-pointer
                                onClick={() => onFindingClick({ start: risk.start, end: risk.end })} // Added onClick handler
                                title="Go to risk in document"
                            >
                                 <ShieldAlert className={cn("h-4 w-4 flex-shrink-0", getRiskIconColor(risk.severity))} />
                                 {/* IMPROVEMENT: Added break-words to prevent overflow */}
                                 <span className="font-medium flex-1 text-foreground break-words">{risk.explanation?.substring(0, 100)}{risk.explanation?.length > 100 ? '...' : ''}</span>
                                 <Badge variant={getRiskBadgeVariant(risk.severity)} className="flex-shrink-0 ml-auto">{risk.severity || 'Unknown'}</Badge>
                            </AccordionTrigger>
                            {/* IMPROVEMENT: Added padding, p tags, and whitespace control */}
                            <AccordionContent className="p-3 pt-0 text-sm text-foreground space-y-2 bg-background/50 rounded-b relative">
                                <Button 
                                    variant="ghost" size="icon_xs" 
                                    className="absolute top-1 right-1 text-muted-foreground hover:text-primary"
                                    onClick={() => onInitiateChat(risk, 'risks')}
                                    title="Discuss this risk in chat"
                                >
                                    <MessageSquarePlus className="h-3 w-3" />
                                </Button>
                                <p className="whitespace-pre-wrap break-words pr-6"><strong>Explanation:</strong> {risk.explanation}</p>
                                {risk.suggestion && <p className="whitespace-pre-wrap break-words text-muted-foreground pr-6"><strong>Suggestion:</strong> {risk.suggestion}</p>}
                           </AccordionContent>
                        </AccordionItem>
                    ))}
                 </Accordion>
            </ScrollArea>
        );
    } else if (typeof resultData === 'object' && 'timeline' in resultData) { // Timeline
        const timelineResult = resultData as TimelineResult;
        const events = timelineResult.timeline || [];
        if (events.length === 0) {
            return <div className="p-4 text-muted-foreground italic">No timeline events extracted.</div>;
        }
        return (
            <ScrollArea className="h-[calc(100vh-250px)] p-4">
                <TimelineView 
                    events={events} 
                    onEventClick={(event) => onFindingClick({ start: event.start, end: event.end })} 
                    onInitiateChat={(event) => onInitiateChat(event, 'timeline')} // Pass callback
                 />
            </ScrollArea>
        );
    } else if (isPrivilegedTermsResult(resultData)) { // Privileged Terms
         const termsResult = resultData;
         const terms = termsResult.privilegedTerms || [];
         if (terms.length === 0) {
             return <div className="p-4 text-muted-foreground italic">No privileged terms found.</div>;
         }
        // Group terms by category
        const groupedTerms = terms.reduce((acc, term) => {
            const category = term.category || 'Uncategorized';
            (acc[category] = acc[category] || []).push(term);
            return acc;
        }, {} as Record<string, PrivilegedTerm[]>);

         return (
             <ScrollArea className="h-[calc(100vh-250px)] p-4">
                 <Accordion type="multiple" className="w-full space-y-2">
                     {Object.entries(groupedTerms).map(([category, items]) => (
                         <AccordionItem value={category} key={category} className="border rounded bg-muted/30">
                             <AccordionTrigger 
                                 className="p-3 text-sm text-left hover:no-underline space-x-2 cursor-pointer"
                             >
                                 <span className="font-medium flex-1 text-foreground uppercase tracking-wider text-xs">{category.replace('_', ' ')}</span>
                                 <Badge variant="outline" className="flex-shrink-0">{items.length}</Badge>
                             </AccordionTrigger>
                             {/* IMPROVEMENT: Added padding and structure */}
                             <AccordionContent className="p-3 pt-0 text-sm text-foreground bg-background/50 rounded-b">
                                 <ul className="list-none space-y-2">
                                     {items.map((term, index) => (
                                         <li 
                                             key={`${category}-${index}-${term.start}`}
                                             className="border rounded p-2 cursor-pointer hover:bg-muted/50 transition-colors relative bg-card"
                                             onClick={() => onFindingClick({ start: term.start, end: term.end })}
                                             title="Go to term in document"
                                         >
                                            <Button 
                                                variant="ghost" size="icon_xs" 
                                                className="absolute top-1 right-1 text-muted-foreground hover:text-primary"
                                                onClick={(e) => { e.stopPropagation(); onInitiateChat(term, 'privilegedTerms'); }}
                                                title="Discuss this term in chat"
                                            >
                                                <MessageSquarePlus className="h-3 w-3" />
                                            </Button>
                                            {/* IMPROVEMENT: Show text and explanation with wrapping */}
                                             <p className="font-medium mb-1 pr-6 break-words">{term.text}</p>
                                             <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words pr-6">{term.explanation}</p>
                                             <Badge variant="secondary" className='mt-1 text-[10px]'>{term.category}</Badge>
                                         </li>
                                     ))}
                                 </ul>
                             </AccordionContent>
                         </AccordionItem>
                     ))}
                 </Accordion>
             </ScrollArea>
         );
    }

    // Fallback if resultData type is not recognized
    console.warn("Unrecognized analysis result structure:", resultData);
    return (
        <div className="p-4">
            <Alert variant="default">
                <Icons.Info className="h-4 w-4" />
                <AlertTitle>Unknown Analysis Format</AlertTitle>
                <AlertDescription>The received analysis data could not be displayed.</AlertDescription>
                <pre className="mt-2 text-xs whitespace-pre-wrap bg-muted/10 p-2 rounded">
                    {JSON.stringify(resultData, null, 2)}
                </pre>
            </Alert>
        </div>
    );
  };

  // Main return of the component
  return renderAnalysisContent();
};

export default DocumentAnalyzer;
