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
    StructuredAnalysisResult 
} from '@/services/documentAnalysisService'; 
import TimelineView from '../timeline/TimelineView'; 
import { RiskAssessment } from './RiskAssessment'; 
import ReactMarkdown from 'react-markdown';
import { Icons } from '@/components/ui/Icons';
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Card, CardContent } from "@/components/ui/Card"; // Removed unused Header/Title
import { ScrollArea } from "@/components/ui/scroll-area";
// Removed unused Badge and Tabs

// Removed internal type alias - rely on props

interface DocumentAnalyzerProps {
  // Removed analysisType
  // Accept the direct result data, which can be various types or null
  resultData: StructuredAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
}

// Removed mock interfaces (Entity, Clause, RiskData) as we use imported types

// Helper function to check if the result is an AnalysisErrorResult
function isAnalysisError(result: StructuredAnalysisResult | null): result is AnalysisErrorResult {
    return typeof result === 'object' && result !== null && 'error' in result && !('entities' in result || 'clauses' in result || 'risks' in result || 'timeline' in result);
}

const DocumentAnalyzer: React.FC<DocumentAnalyzerProps> = ({ 
    resultData, // Use resultData prop
    isLoading, 
    error 
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
    if (typeof resultData === 'string') { // Summary
        return (
            <ScrollArea className="h-[calc(100vh-250px)] p-4"> 
                <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">
                {resultData}
                </ReactMarkdown>
            </ScrollArea>
        );
    } else if (typeof resultData === 'object' && 'entities' in resultData) { // Entities
        const entitiesResult = resultData as EntitiesResult;
        const entities = entitiesResult.entities || [];
        if (entities.length === 0) {
            return <div className="p-4 text-muted-foreground italic">No entities found.</div>;
        }
        const groupedEntities = entities.reduce((acc, entity) => {
            (acc[entity.type] = acc[entity.type] || []).push(entity.text);
            return acc;
        }, {} as Record<string, string[]>);
        return (
            <ScrollArea className="h-[calc(100vh-250px)] p-4 space-y-4"> 
                {Object.entries(groupedEntities).map(([type, texts]) => (
                    <div key={type}>
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wider">{type.replace('_', ' ')}</h4>
                        <ul className="list-disc list-inside space-y-1">
                            {texts.map((text, index) => (
                                <li key={`${type}-${index}`} className="text-sm text-foreground">{text}</li>
                            ))}
                        </ul>
                    </div>
                ))}
            </ScrollArea>
        );
    } else if (typeof resultData === 'object' && 'clauses' in resultData) { // Clauses
        const clausesResult = resultData as ClausesResult;
        const clauses = clausesResult.clauses || [];
        if (clauses.length === 0) {
            return <div className="p-4 text-muted-foreground italic">No key clauses identified.</div>;
        }
        return (
            <ScrollArea className="h-[calc(100vh-250px)] p-4 space-y-3"> 
                {clauses.map((clause, index) => (
                    <Card key={`${clause.start}-${index}`} className="bg-muted/30">
                        <CardContent className="p-3 text-sm text-foreground space-y-1">
                            <p className="font-medium">{clause.title}</p>
                            <p className="text-muted-foreground text-xs italic">"{clause.text}"</p>
                            <p>{clause.analysis}</p>
                        </CardContent>
                    </Card>
                ))}
            </ScrollArea>
        );
    } else if (typeof resultData === 'object' && 'risks' in resultData) { // Risks
        const risksResult = resultData as RisksResult;
        return (
            <ScrollArea className="h-[calc(100vh-250px)] p-4"> 
                <RiskAssessment analysisResult={risksResult} /> 
            </ScrollArea>
        );
    }
    
    // Fallback for unknown result structure
    return <div className="p-4 text-muted-foreground italic">Unsupported analysis result format.</div>;
  };

  return (
    <div className="analysis-content h-full">
      {renderAnalysisContent()}
    </div>
  );
};

export default DocumentAnalyzer;
