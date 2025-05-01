import { supabase } from '../lib/supabaseClient';
import { useSetAtom } from 'jotai'; // Import useSetAtom
import { BackgroundTask, TaskStatus, addTaskAtom, updateTaskAtom, removeTaskAtom } from '@/atoms/appAtoms'; // Import task atoms
import { v4 as uuidv4 } from 'uuid'; // Import uuid
// Remove OPENAI_CONFIG import as it's no longer used client-side
// import { OPENAI_CONFIG } from '../config/apiConfig'; 

// --- Structured Result Types ---

// Base structure for items with positional data
export interface PositionalItem {
    start: number;
    end: number;
}

// Type for Entities analysis result
export interface Entity extends PositionalItem {
    text: string;
    type: 'PERSON' | 'ORGANIZATION' | 'DATE' | 'LOCATION' | 'LEGAL_TERM' | 'FINANCIAL_TERM';
}
export interface EntitiesResult {
    entities: Entity[];
}

// Type for Clauses analysis result
export interface Clause extends PositionalItem {
    title: string;
    text: string;
    analysis: string;
}
export interface ClausesResult {
    clauses: Clause[];
}

// Type for Risks analysis result
export interface Risk extends PositionalItem {
    title: string;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    explanation: string;
}
export interface RisksResult {
    risks: Risk[];
}

// Type for Timeline analysis result
export interface TimelineEvent extends PositionalItem {
    date: string; // ISO 8601 or descriptive
    event: string;
    parties?: string[];
}
export interface TimelineResult {
    timeline: TimelineEvent[];
}

// Type for raw error response from analysis function
export interface AnalysisErrorResult {
    error: string;
    rawResponse?: string;
}

// Union type for possible structured results (or simple string for summary/custom)
export type StructuredAnalysisResult = 
    | string 
    | EntitiesResult 
    | ClausesResult 
    | RisksResult 
    | TimelineResult
    | AnalysisErrorResult // Include error type
    | any; // Fallback for custom or unparsed results

// Define the type for analysis results returned by the backend function
// This should match the structure returned by the analyze-document function
export interface BackendAnalysisResponse {
  success: boolean;
  analysisId: string; 
  result: StructuredAnalysisResult; // Use the more specific type
}

/**
 * Document Analysis Results (represents stored data)
 */
export interface DocumentAnalysisResult {
  id: string;
  documentId: string;
  analysisType: 'summary' | 'entities' | 'clauses' | 'risks' | 'timeline' | 'custom' | 'privilegedTerms' | 'document_context';
  result: StructuredAnalysisResult; // Use the more specific type
  createdAt: string;
}

// Define analysis types for function parameters
export type AnalysisType = 'summary' | 'entities' | 'clauses' | 'risks' | 'timeline' | 'custom' | 'privilegedTerms' | 'document_context';

// REMOVED: Client-side interfaces like DocumentEntity, LegalClause, etc., 
// as the backend function handles the primary analysis.
// These could be reintroduced if needed for detailed client-side rendering of structured results.

// REMOVED: chunkDocumentText function, as chunking/prompting happens backend.

// --- Hook for using task atoms within the service (if preferred over passing setters) ---
// Note: This approach might be less common for pure service functions but is an option.
// Alternatively, pass the atom setters as arguments to analyzeDocument.
// For simplicity, let's assume analyzeDocument is called from components where hooks are available
// OR we modify analyzeDocument to accept the setters.

// Let's modify analyzeDocument to accept setters (more typical for services)

/**
 * Invokes the backend Supabase Function to analyze a document.
 */
export const analyzeDocument = async ({
  documentId,
  analysisType,
  customPrompt,
  addTask,
  updateTask,
  removeTask,
}: {
  documentId: string;
  analysisType: AnalysisType;
  customPrompt?: string;
  addTask: (task: Omit<BackgroundTask, 'createdAt'>) => void;
  updateTask: (update: { id: string; status?: TaskStatus; progress?: number; description?: string }) => void;
  removeTask: (taskId: string) => void;
}): Promise<{ data: StructuredAnalysisResult | null; error: Error | null; analysisId?: string }> => {
  const taskId = uuidv4();
  const taskDescription = `Analyzing ${analysisType} for document...`; // Simplified desc

  try {
    console.log(`Invoking analyze-document function for Doc ID: ${documentId}, Type: ${analysisType}`);
    
    addTask({ 
        id: taskId, 
        description: taskDescription, 
        status: 'running', // Use 'running'
        progress: 0 
    });

    const { data, error } = await supabase.functions.invoke<BackendAnalysisResponse>('analyze-document', {
      body: { documentId, analysisType, customPrompt },
    });

    if (error) {
      console.error('Error invoking analyze-document function:', error);
      updateTask({ id: taskId, status: 'error', description: `Function invocation failed: ${error.message}` });
      setTimeout(() => removeTask(taskId), 15000);
      throw new Error(`Function invocation failed: ${error.message}`);
    }

    if (!data) { 
         updateTask({ id: taskId, status: 'error', description: 'Analysis function returned no data.' });
         setTimeout(() => removeTask(taskId), 15000);
         throw new Error('Analysis function returned no data.');
    }
    if (!data.success) {
        const backendErrorMsg = (data.result as AnalysisErrorResult)?.error || (data as any)?.error || 'Analysis function reported failure.';
        console.error('Backend analysis function failed:', backendErrorMsg);
        if ((data.result as AnalysisErrorResult)?.rawResponse) {
            console.error('Raw response from failed analysis:', (data.result as AnalysisErrorResult).rawResponse);
        }
        updateTask({ id: taskId, status: 'error', description: `Analysis failed: ${backendErrorMsg}` });
        setTimeout(() => removeTask(taskId), 15000);
        throw new Error(backendErrorMsg);
    }

    console.log(`Analysis successful for Doc ID: ${documentId}, Analysis ID: ${data.analysisId}`);
    updateTask({ id: taskId, status: 'success', progress: 100, description: `Analysis complete for ${analysisType}` }); // Use 'success'
    setTimeout(() => removeTask(taskId), 5000); 

    return { data: data.result, error: null, analysisId: data.analysisId };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error during document analysis request';
    console.error(`Error in analyzeDocument for ${documentId}:`, message);
     updateTask({ id: taskId, status: 'error', description: `Error: ${message}` }); // Use 'error'
     setTimeout(() => removeTask(taskId), 15000);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Get previously stored analysis results for a document.
 */
export const getDocumentAnalyses = async (
  documentId: string,
  analysisType?: AnalysisType // Use the defined type
): Promise<{ data: DocumentAnalysisResult[] | null; error: Error | null }> => {
  try {
    let query = supabase
      .from('document_analyses')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });

    if (analysisType) {
      query = query.eq('analysis_type', analysisType);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Use the StructuredAnalysisResult type here as well
    const results: DocumentAnalysisResult[] = (data || []).map(item => ({
        id: item.id,
        documentId: item.document_id,
        analysisType: item.analysis_type as AnalysisType,
        result: item.result as StructuredAnalysisResult, // Cast the result
        createdAt: item.created_at
    }));

    return { data: results, error: null };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error getting document analyses';
    console.error(`Error getting analyses for ${documentId}:`, message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
};

// *** REMOVED: extractTimelineEvents function ***
// The analyzeDocument function now handles timeline extraction by passing
// analysisType = 'timeline'. The backend function returns parsed JSON.
// Client-side code that previously called extractTimelineEvents should now call
// analyzeDocument('documentId', 'timeline') and handle the returned JSON data.
