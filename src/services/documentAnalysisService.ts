import { supabase } from '@/lib/supabaseClient';
import { useSetAtom } from 'jotai'; // Import useSetAtom
import { BackgroundTask, TaskStatus, addTaskAtom, updateTaskAtom, removeTaskAtom } from '@/atoms/appAtoms'; // Import task atoms
import { v4 as uuidv4 } from 'uuid'; // Import uuid
// Remove OPENAI_CONFIG import as it's no longer used client-side
// import { OPENAI_CONFIG } from '../config/apiConfig'; 
import { type Case } from '../types'; // Ensure this path is correct if used

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
  const taskDescription = `Analyzing ${analysisType} for document...`;

  try {
    console.log(`[SVC] Invoking analyze-document function for Doc ID: ${documentId}, Type: ${analysisType}`);
    
    addTask({ 
        id: taskId, 
        description: taskDescription, 
        status: 'running',
        progress: 0 
    });

    // First, get the document text
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .select('extracted_text')
      .eq('id', documentId)
      .single();

    if (docError) {
      console.error('[SVC] Failed to fetch document text:', docError);
      updateTask({ id: taskId, status: 'error', description: `Failed to fetch document text: ${docError.message}` });
      setTimeout(() => removeTask(taskId), 15000);
      return { data: null, error: new Error(`Failed to fetch document text: ${docError.message}`), analysisId: undefined };
    }

    if (!docData || !docData.extracted_text) {
      console.error('[SVC] Document has no extracted text');
      updateTask({ id: taskId, status: 'error', description: 'Document has no extracted text to analyze' });
      setTimeout(() => removeTask(taskId), 15000);
      return { data: null, error: new Error('Document has no extracted text to analyze'), analysisId: undefined };
    }

    // Now call the function with the document text
    const { data: invokeData, error: invokeError } = await supabase.functions.invoke<BackendAnalysisResponse>('analyze-document', {
      body: { 
        documentId, 
        analysisType, 
        customPrompt,
        documentText: docData.extracted_text 
      },
    });

    console.log('[SVC] Raw response from invoke:', { invokeData, invokeError });

    if (invokeError) {
      console.error('[SVC] Error invoking analyze-document function:', invokeError);
      updateTask({ id: taskId, status: 'error', description: `Function invocation failed: ${invokeError.message}` });
      setTimeout(() => removeTask(taskId), 15000);
      return { data: null, error: new Error(`Function invocation failed: ${invokeError.message}`), analysisId: undefined };
    }

    if (!invokeData) { 
         console.error('[SVC] Analysis function returned OK status but no data object.');
         updateTask({ id: taskId, status: 'error', description: 'Analysis function returned no data.' });
         setTimeout(() => removeTask(taskId), 15000);
         return { data: null, error: new Error('Analysis function returned no data object.'), analysisId: undefined }; 
    }
    
    if (!invokeData.success) {
        const backendErrorMsg = (invokeData.result as AnalysisErrorResult)?.error || (invokeData as any)?.error || 'Analysis function reported failure.';
        console.error('[SVC] Backend analysis function failed:', backendErrorMsg);
        if ((invokeData.result as AnalysisErrorResult)?.rawResponse) {
            console.error('[SVC] Raw response from failed analysis:', (invokeData.result as AnalysisErrorResult).rawResponse);
        }
        updateTask({ id: taskId, status: 'error', description: `Analysis failed: ${backendErrorMsg}` });
        setTimeout(() => removeTask(taskId), 15000);
        return { data: null, error: new Error(backendErrorMsg), analysisId: undefined }; 
    }

    console.log(`[SVC] Analysis successful. Returning result:`, invokeData.result);
    updateTask({ id: taskId, status: 'success', progress: 100, description: `Analysis complete for ${analysisType}` });
    setTimeout(() => removeTask(taskId), 5000); 

    return { data: invokeData.result, error: null, analysisId: invokeData.analysisId };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error during document analysis request';
    console.error(`[SVC] Unexpected error in analyzeDocument for ${documentId}:`, message);
     updateTask({ id: taskId, status: 'error', description: `Client-side error: ${message}` });
     setTimeout(() => removeTask(taskId), 15000);
    return { data: null, error: error instanceof Error ? error : new Error(message), analysisId: undefined }; 
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

export interface SummarizeTextPayload {
  textToSummarize: string;
  instructions?: string;
  surroundingContext?: string;
  stream?: boolean;
}

export interface SummarizeTextResponse {
  result?: string; // For non-streamed
  // Streaming handled by direct EventSource usage on client if needed
  error?: string;
}

export interface RewriteTextPayload {
  textToRewrite: string;
  mode: 'improve' | 'shorten' | 'expand' | 'professional' | 'formal' | 'simple' | 'custom';
  instructions?: string; // Required if mode is 'custom'
  surroundingContext?: string;
  stream?: boolean;
}

export interface RewriteTextResponse {
  result?: string; // For non-streamed
  error?: string;
}

export interface GenerateInlineTextPayload {
  instructions: string;
  selectedText?: string;
  surroundingContext?: string;
  // stream parameter is implicit for this service, always true for the function call
}

export interface GenerateInlineTextResponse { // This is for a non-streaming scenario, less relevant here.
  result?: string;
  error?: string;
}

/**
 * Calls the 'summarize-text' Supabase edge function.
 */
export const summarizeTextService = async (payload: SummarizeTextPayload): Promise<SummarizeTextResponse> => {
  // For summarization, streaming might be less critical for a modal display, 
  // but the function supports it. Let's default to non-stream for simplicity here.
  const { data, error } = await supabase.functions.invoke('summarize-text', {
    body: { ...payload, stream: payload.stream === undefined ? false : payload.stream },
  });

  if (error) {
    console.error('Error summarizing text:', error);
    return { error: error.message };
  }
  return data as SummarizeTextResponse; // Assuming non-streamed response structure
};

/**
 * Calls the 'rewrite-text' Supabase edge function.
 */
export const rewriteTextService = async (payload: RewriteTextPayload): Promise<RewriteTextResponse> => {
  // Default to non-stream for now, suggestion UI might not need streaming initially.
  const { data, error } = await supabase.functions.invoke('rewrite-text', {
    body: { ...payload, stream: payload.stream === undefined ? false : payload.stream },
  });

  if (error) {
    console.error('Error rewriting text:', error);
    return { error: error.message };
  }
  return data as RewriteTextResponse;
};

/**
 * Calls the 'generate-inline-text' Supabase edge function for streaming.
 * Returns an object containing a ReadableStreamDefaultReader or an error message.
 */
export const generateInlineTextService = async (
  payload: GenerateInlineTextPayload
): Promise<{ reader: ReadableStreamDefaultReader<Uint8Array> | null; error: string | null }> => {
  try {
    // Invoke the function. The Supabase client handles the stream.
    // The `data` field in the response should be a ReadableStream.
    const { data, error: invokeError } = await supabase.functions.invoke('generate-inline-text', {
      body: { ...payload, stream: true }, // Ensure the edge function expects `stream: true`
    });

    if (invokeError) {
      console.error('Error invoking generate-inline-text function:', invokeError);
      return { reader: null, error: invokeError.message };
    }

    // Check if the data is indeed a ReadableStream
    if (data instanceof ReadableStream) {
      return { reader: data.getReader(), error: null };
    } else {
      // This case should ideally not happen if the edge function streams correctly
      // and the client interprets it as a stream.
      console.error('generateInlineTextService: Expected a ReadableStream, but received:', typeof data, data);
      // If `data` contains an error structure from the function itself (e.g., JSON error before streaming starts)
      if (typeof data === 'object' && data !== null && data.error && typeof data.error === 'string') {
         return { reader: null, error: `Function returned an error: ${data.error}` };
      }
      return { reader: null, error: 'Response was not a ReadableStream as expected.' };
    }
  } catch (err: any) {
    console.error('Catch block error in generateInlineTextService:', err);
    return { reader: null, error: err.message || 'An unexpected error occurred during stream setup.' };
  }
};
