import { supabase } from '../lib/supabaseClient';
import { type DispatcherResponse } from '../lib/taskDispatcher';
import { type SourceInfo } from '@/types/sources';
import { type TaskStatus } from '@/atoms/appAtoms';
import { analyzeDocument as analyzeDocumentService } from './documentAnalysisService'; // Needed for flagPrivilegedTerms
import { getConversationMessages, mapToVercelMessages } from './messageService'; // Needed for genericChat
import { v4 as uuidv4 } from 'uuid'; // Needed for genericChat
import { Message as ChatMessage } from '@/components/chat/ChatMessage'; // Needed for genericChat
import { Message as VercelChatMessage } from 'ai'; // Import for payload type
import { processSupabaseStream, parseGenericStreamChunks, parseVercelAiSdkChunks } from '../lib/streamingUtils';

console.log('Agent service initializing...');

// Define types for task update/remove functions
type UpdateTaskFn = (update: { id: string; status?: TaskStatus; progress?: number; description?: string }) => void;
type RemoveTaskFn = (taskId: string) => void;

// --- Interfaces for Supabase function payloads ---
interface AgentDraftPayload {
  instructions: string;
  caseId?: string;
  documentContext?: string;
  analysisContext?: string;
  userId?: string;
}

interface FindClausePayload {
  docId: string;
  clause: string;
  userId?: string;
}

interface ExplainTermPayload {
  term: string;
  jurisdiction?: string;
  caseId?: string;
}

interface AgentComparePayload {
  caseId: string;
  documentContexts: string[];
  analysisContext?: string;
  userId?: string;
}

interface PerplexityPayload {
    query: string;
    model?: string;
}

interface RewritePayload {
    textToRewrite: string;
    instructions?: string;
    surroundingContext?: string;
    // stream?: boolean; // If we add non-streaming later
}

interface SummarizePayload {
    textToSummarize: string;
    instructions?: string;
    surroundingContext?: string;
    // stream?: boolean; // If we add non-streaming later
}

interface GenericChatPayload {
    messages: VercelChatMessage[]; // Use imported type
    modelId?: string;
    useWebSearch?: boolean;
    caseId?: string;
    documentContext?: string[];
}

// --- Agent/Tool Functions (Moved from chatService.ts) ---

/**
 * Handle a /research query using the courtlistener-rag Supabase Edge Function
 */
export const handleResearchQueryStream = async (
  researchQuery: string,
  onChunk: (chunk: string) => void
): Promise<DispatcherResponse> => {
  console.log(`Handling Research Query (via Streaming Edge Function): "${researchQuery}"`);
  let sources: SourceInfo[] | undefined;

  // Use the imported processSupabaseStream helper
  const streamResult = await processSupabaseStream(
      'courtlistener-rag',
      { query: researchQuery },
      onChunk,
      (receivedSnippets: SourceInfo[]) => {
          console.log('Received snippets:', receivedSnippets);
          sources = receivedSnippets;
      },
      (errorMessage) => {
          onChunk(`\n--- Stream Error: ${errorMessage} ---`);
      },
      parseGenericStreamChunks // Use default parser, courtlistener-rag likely sends plain text or simple events
  );

  return {
      success: streamResult.success,
      error: streamResult.error,
      sources: sources
  };
};

/**
 * Handle a /agent draft query using the 'agent-draft' Supabase Edge function
 */
export const handleAgentDraftStream = async (
  instructions: string,
  caseId?: string,
  documentContext?: string,
  analysisContext?: string,
  taskId?: string,
  updateTask?: UpdateTaskFn,
  removeTask?: RemoveTaskFn
): Promise<{ success: boolean; error: Error | null; draftContent?: string }> => {
  let userId: string | undefined;
  try {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id;
  } catch (authError) {
      console.error('Auth error getting user for agent-draft:', authError);
      return { success: false, error: new Error('Authentication error.') };
  }
  if (!userId) {
      return { success: false, error: new Error('User not authenticated.') };
  }

  console.log(`Handling Agent Draft (via Edge Function) for case ${caseId}`);
  if (taskId && updateTask) updateTask({ id: taskId, status: 'running', description: 'Generating AI draft...' });

  try {
    const payload: AgentDraftPayload = {
      instructions,
      caseId,
      documentContext,
      analysisContext,
      userId,
    };

    // Use processSupabaseStream to get the full response
    let fullDraftContent = '';
    const result = await processSupabaseStream(
        'agent-draft', 
        payload, 
        (chunk) => { fullDraftContent += chunk; }, // Collect chunks
        undefined, 
        undefined, 
        parseGenericStreamChunks // agent-draft uses generic SSE now
    );

    if (result.success) {
      console.log('Agent draft stream finished successfully.');
      if (taskId && updateTask) updateTask({ id: taskId, status: 'success', description: 'Draft generation complete' });
      // Return the collected content
      return { success: true, error: null, draftContent: fullDraftContent }; 
    } else {
      throw result.error || new Error('Unknown error during agent draft stream processing');
    }
  } catch (error) {
    console.error('Error in handleAgentDraftStream:', error);
    // Don't call onChunk here as it was removed
    // onChunk(`Error drafting: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (taskId && updateTask) updateTask({ id: taskId, status: 'error', description: `Draft failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    return { success: false, error: error instanceof Error ? error : new Error('Unknown draft error'), draftContent: undefined };
  } finally {
    if (taskId && removeTask) removeTask(taskId);
  }
};

/**
 * Handle a /find-clause query using the 'find-clause' Supabase Edge function
 */
export const handleFindClauseStream = async (
  clause: string,
  docId: string,
  onChunk: (chunk: string) => void,
  taskId?: string,
  updateTask?: UpdateTaskFn,
  removeTask?: RemoveTaskFn
): Promise<{ success: boolean; error: Error | null; answer?: string }> => {
  let userId: string | undefined;
  try {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id;
  } catch (authError) {
      console.error('Auth error getting user for find-clause:', authError);
      return { success: false, error: new Error('Authentication error.') };
  }

  if (!userId) {
      return { success: false, error: new Error('User not authenticated.') };
  }

  console.log(`Handling Find Clause (via Edge Function) for doc ${docId}, clause: "${clause}"`);

  try {
    const payload: FindClausePayload = {
      docId,
      clause,
      userId,
    };
    const result = await processSupabaseStream('find-clause', payload, onChunk, undefined, undefined, parseVercelAiSdkChunks);
    if (result.success) {
      if (taskId && updateTask) updateTask({ id: taskId, status: 'success', description: 'Clause search complete' });
      return { success: true, error: null, answer: result.fullResponse };
    } else {
      if (taskId && updateTask) updateTask({ id: taskId, status: 'error', description: `Clause search failed: ${result.error?.message}` });
      return { success: false, error: result.error, answer: undefined };
    }
  } catch (error) {
    console.error('Error in handleFindClauseStream:', error);
    onChunk(`Error finding clause: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (taskId && updateTask) updateTask({ id: taskId, status: 'error', description: `Clause search failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    return { success: false, error: error instanceof Error ? error : new Error('Unknown clause search error'), answer: undefined };
  } finally {
    if (taskId && removeTask) removeTask(taskId);
  }
};

/**
 * Handle a /agent explain_term query using the 'explain-term' Supabase Edge function
 */
export const handleExplainTermStream = async (
  term: string,
  onChunk: (chunk: string) => void,
  jurisdiction?: string,
  caseId?: string,
  taskId?: string,
  updateTask?: UpdateTaskFn,
  removeTask?: RemoveTaskFn
): Promise<{ success: boolean; error: Error | null; answer?: string }> => {
  console.log(`Handling Explain Term (via Edge Function): ${term}, Jurisdiction: ${jurisdiction}`);

  try {
    const payload: ExplainTermPayload = {
      term,
      jurisdiction,
      caseId,
    };
    const result = await processSupabaseStream('explain-term', payload, onChunk, undefined, undefined, parseVercelAiSdkChunks);
    if (result.success) {
      if (taskId && updateTask) updateTask({ id: taskId, status: 'success', description: 'Term explanation complete' });
      return { success: true, error: null, answer: result.fullResponse };
    } else {
      if (taskId && updateTask) updateTask({ id: taskId, status: 'error', description: `Term explanation failed: ${result.error?.message}` });
      return { success: false, error: result.error, answer: undefined };
    }
  } catch (error) {
    console.error('Error in handleExplainTermStream:', error);
    onChunk(`Error explaining term: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (taskId && updateTask) updateTask({ id: taskId, status: 'error', description: `Term explanation failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    return { success: false, error: error instanceof Error ? error : new Error('Unknown term explanation error'), answer: undefined };
  } finally {
    if (taskId && removeTask) removeTask(taskId);
  }
};

/**
 * Handle a /agent compare query using the 'compare-documents' Supabase Edge function
 */
export const handleAgentCompareStream = async (
  onChunk: (chunk: string) => void,
  caseId: string,
  documentContexts?: string | string[],
  analysisContext?: string,
  taskId?: string,
  updateTask?: UpdateTaskFn,
  removeTask?: RemoveTaskFn
): Promise<{ success: boolean; error: Error | null; answer?: string }> => {
  const docIds = Array.isArray(documentContexts)
    ? documentContexts
    : (documentContexts ? [documentContexts] : []);

  if (docIds.length < 2) {
    const error = new Error('Compare agent requires at least two document IDs.');
    onChunk(`Error: ${error.message}`);
    return { success: false, error };
  }

  let userId: string | undefined;
  try {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id;
  } catch (authError) {
      console.error('Auth error getting user for compare-documents:', authError);
      return { success: false, error: new Error('Authentication error.') };
  }
  if (!userId) {
      return { success: false, error: new Error('User not authenticated.') };
  }

  console.log(`Handling Agent Compare (via Edge Function) for docs: ${docIds.join(', ')}`);

  try {
    const payload: AgentComparePayload = {
      caseId,
      documentContexts: docIds,
      analysisContext,
      userId,
    };
    const result = await processSupabaseStream('compare-documents', payload, onChunk, undefined, undefined, parseVercelAiSdkChunks);
    if (result.success) {
      if (taskId && updateTask) updateTask({ id: taskId, status: 'success', description: 'Comparison complete' });
      return { success: true, error: null, answer: result.fullResponse };
    } else {
      if (taskId && updateTask) updateTask({ id: taskId, status: 'error', description: `Comparison failed: ${result.error?.message}` });
      return { success: false, error: result.error, answer: undefined };
    }
  } catch (error) {
    console.error('Error in handleAgentCompareStream:', error);
    onChunk(`Error comparing documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (taskId && updateTask) updateTask({ id: taskId, status: 'error', description: `Comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    return { success: false, error: error instanceof Error ? error : new Error('Unknown comparison error'), answer: undefined };
  } finally {
    if (taskId && removeTask) removeTask(taskId);
  }
};

// Note: handleFlagPrivilegedTermsStream uses analyzeDocumentService directly.
// Consider if it truly belongs in agentService or documentAnalysisService.
interface AnalysisResultData {
    result?: string[] | string | object;
}
export const handleFlagPrivilegedTermsStream = async (
  docId: string,
  onChunk: (chunk: string) => void,
  caseId: string,
  taskId?: string,
  updateTask?: UpdateTaskFn,
  removeTask?: RemoveTaskFn
): Promise<{ success: boolean; error: Error | null; answer?: string }> => {
  console.log(`Starting handleFlagPrivilegedTermsStream for docId: ${docId} in case: ${caseId}`);
  try {
    const { data: caseDocLink, error: linkError } = await supabase
      .from('case_documents').select('document_id').eq('case_id', caseId).eq('document_id', docId).maybeSingle();
    if (linkError || !caseDocLink) throw linkError || new Error('Document not found or access denied.');

    onChunk('Analyzing document for potentially privileged terms...\n\n');

    const dummyAddTask = () => {};
    const dummyUpdateTask = () => {};
    const dummyRemoveTask = () => {};

    // This function calls another service, doesn't invoke a supabase function itself
    const { data, error } = await analyzeDocumentService({
        documentId: docId,
        analysisType: 'privilegedTerms',
        addTask: dummyAddTask,
        updateTask: dummyUpdateTask,
        removeTask: dummyRemoveTask
    });

    if (error || !data) {
      console.error('Error flagging privileged terms:', error);
      onChunk(`Error: Unable to analyze document for privileged terms. ${error?.message || 'Unknown error'}`);
      return { success: false, error: error || new Error('Unknown error') };
    }

    let resultText = 'Analysis complete.\n\n';
    const terms = (data as AnalysisResultData)?.result;
    if (terms && Array.isArray(terms) && terms.length > 0) {
      resultText += 'Potentially Privileged Terms Found:\n';
      terms.forEach((term: string, index: number) => {
        resultText += `${index + 1}. ${term}\n`;
      });
      resultText += '\nPlease review these terms in context to confirm privilege.';
    } else {
      resultText += 'No potentially privileged terms were automatically detected.';
    }

    onChunk(resultText);
    console.log('Flag privileged terms analysis complete.');
    if (taskId && updateTask) updateTask({ id: taskId, status: 'success', description: 'Privileged terms flagged' });
    return { success: true, error: null, answer: resultText };
  } catch (e: unknown) {
     const error = e instanceof Error ? e : new Error('Unknown error flagging privileged terms');
     console.error('Error handling flag privileged terms:', error.message, e);
     const errorMessage = error instanceof Error ? error.message : 'Unknown error flagging privileged terms';
     onChunk(`Error: An unexpected error occurred while flagging terms. ${errorMessage}`);
     if (taskId && updateTask) updateTask({ id: taskId, status: 'error', description: `Flagging failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
     return { success: false, error };
  } finally {
    if (taskId && removeTask) removeTask(taskId);
  }
};

/**
 * Handle a /agent perplexity query using the Supabase Edge function
 */
export const handlePerplexityAgent = async (
  _conversationId: string, // Often unused directly but good for context/logging
  params: { query: string; model?: string },
  onChunk: (chunk: string) => void,
  taskId?: string,
  updateTask?: UpdateTaskFn,
  removeTask?: RemoveTaskFn
): Promise<DispatcherResponse> => {
  console.log(`Handling Perplexity Agent (via Streaming Edge Function) for query: ${params.query}`);

  try {
    const { query, model = 'llama-3-sonar-large-32k-online' } = params;
    const payload: PerplexityPayload = {
      query,
      model,
    };

    // Use the local processSupabaseStream helper defined in this file
    // perplexity-search likely sends plain text or simple events
    const result = await processSupabaseStream('perplexity-search', payload, onChunk, undefined, undefined, parseGenericStreamChunks);
    if (result.success) {
      if (taskId && updateTask) updateTask({ id: taskId, status: 'success', description: 'Perplexity query complete' });
      return { success: true, sources: result.sources as SourceInfo[] | undefined };
    } else {
      if (taskId && updateTask) updateTask({ id: taskId, status: 'error', description: `Perplexity query failed: ${result.error?.message}` });
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('Error calling perplexity-search function:', error);
    onChunk(`Error processing Perplexity query: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (taskId && updateTask) updateTask({ id: taskId, status: 'error', description: `Perplexity query failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    return { success: false, error: error instanceof Error ? error : new Error('Unknown Perplexity agent error') };
  } finally {
    if (taskId && removeTask) removeTask(taskId);
  }
};

/**
 * Handle a rewrite action using the 'rewrite-text' Supabase Edge function (Streaming)
 */
export const handleRewriteStream = async (
  selectedText: string,
  onChunk: (chunk: string) => void,
  caseId: string,
  documentId: string,
  surroundingContext?: string,
  instructions?: string,
  taskId?: string,
  updateTask?: UpdateTaskFn,
  removeTask?: RemoveTaskFn
): Promise<{ success: boolean; error: Error | null; answer?: string }> => {
  console.log(`Invoking rewrite-text function for doc ${documentId} in case ${caseId}`);
  try {
    const invokePayload: RewritePayload = {
      textToRewrite: selectedText,
      instructions,
      surroundingContext,
    };

    // Use the local processSupabaseStream helper defined in this file
    // rewrite-text likely uses Vercel AI SDK format
    const result = await processSupabaseStream(
        'rewrite-text',
        invokePayload, 
        onChunk, 
        undefined, 
        undefined, 
        parseGenericStreamChunks // Use the correct generic SSE parser
    );

    if (result.success) {
        console.log('Rewrite stream finished successfully.');
        if (taskId && updateTask) updateTask({ id: taskId, status: 'success', description: 'Rewrite complete' });
        return { success: true, error: null, answer: result.fullResponse };
    } else {
        throw result.error || new Error('Unknown error during rewrite stream processing');
    }

  } catch (error) {
    console.error('Error in handleRewriteStream:', error);
    onChunk(`\n\n--- ERROR ---\n${error instanceof Error ? error.message : 'Unknown error'}`);
    if (taskId && updateTask) updateTask({ id: taskId, status: 'error', description: `Rewrite failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    return { success: false, error: error instanceof Error ? error : new Error('Unknown rewrite error'), answer: undefined };
  } finally {
    if (taskId && removeTask) removeTask(taskId);
  }
};

/**
 * Handle a summarize action using the 'summarize-text' Supabase Edge function (Streaming)
 */
export const handleSummarizeStream = async (
  selectedText: string,
  onChunk: (chunk: string) => void,
  caseId: string,
  documentId: string,
  surroundingContext?: string,
  instructions?: string,
  taskId?: string,
  updateTask?: UpdateTaskFn,
  removeTask?: RemoveTaskFn
): Promise<{ success: boolean; error: Error | null; answer?: string }> => {
  console.log(`Invoking summarize-text function for doc ${documentId} in case ${caseId}`);
  try {
    const invokePayload: SummarizePayload = {
      textToSummarize: selectedText,
      instructions,
      surroundingContext,
    };

    // Use the local processSupabaseStream helper defined in this file
    // summarize-text likely uses Vercel AI SDK format
    const result = await processSupabaseStream(
        'summarize-text',
        invokePayload,
        onChunk,
        undefined,
        undefined,
        parseGenericStreamChunks // Use the correct generic SSE parser
    );

    if (result.success) {
        console.log('Summarize stream finished successfully.');
        if (taskId && updateTask) updateTask({ id: taskId, status: 'success', description: 'Summarization complete' });
        return { success: true, error: null, answer: result.fullResponse };
    } else {
        throw result.error || new Error('Unknown error during summarize stream processing');
    }

  } catch (error) {
    console.error('Error in handleSummarizeStream:', error);
    onChunk(`\n\n--- ERROR ---\n${error instanceof Error ? error.message : 'Unknown error'}`);
    if (taskId && updateTask) updateTask({ id: taskId, status: 'error', description: `Summarization failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    return { success: false, error: error instanceof Error ? error : new Error('Unknown summarization error'), answer: undefined };
  } finally {
    if (taskId && removeTask) removeTask(taskId);
  }
};

/**
 * Handle Generic Chat using the 'generic-chat-agent' Supabase Edge function (Streaming)
 */
export async function handleGenericChatStream(
  messageContent: string,
  conversationId: string | undefined,
  onChunk: (chunk: string) => void,
  modelId: string | undefined,
  useWebSearch: boolean,
  caseId?: string,
  documentContext?: string[],
  taskId?: string,
  updateTask?: UpdateTaskFn,
): Promise<DispatcherResponse> {
  console.log(`Invoking generic-chat-agent: model=${modelId}, webSearch=${useWebSearch}, message=${messageContent}`);

  if (taskId && updateTask) {
    updateTask({ id: taskId, status: 'running', description: `Generating response with ${modelId || 'default'}...` });
  }

  try {
    // Fetch message history using messageService
    let history: ChatMessage[] = [];
    if (conversationId) {
        const { data: historyData, error } = await getConversationMessages(conversationId);
        if (error) {
            console.error('Error fetching history for generic chat:', error);
            // Decide if we should proceed without history or throw?
            // Proceeding without history for now.
        } else {
            history = historyData || [];
        }
    }
    // Add the current user message
    const currentMessage: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: messageContent,
        timestamp: new Date().toISOString(),
        conversation_id: conversationId
    };
    const messagesToSend = [...history, currentMessage];

    const vercelMessages = mapToVercelMessages(messagesToSend);

    const payload: GenericChatPayload = {
      messages: vercelMessages,
      modelId: modelId,
      useWebSearch: useWebSearch,
      caseId: caseId,
      documentContext: documentContext,
    };

    // Use the local processSupabaseStream helper defined in this file
    // Pass the specific parser for Vercel AI SDK format
    const result = await processSupabaseStream(
        'generic-chat-agent',
        payload,
        onChunk,
        undefined, // No snippets expected from this endpoint
        undefined, // Use default error handling
        parseVercelAiSdkChunks // Pass the specific parser
    );

    if (result.success) {
        console.log('Generic chat processing complete.');
        if (taskId && updateTask) {
            updateTask({ id: taskId, status: 'success' });
        }
        return { success: true };
    } else {
         throw result.error || new Error('Unknown error during generic chat stream processing');
    }

  } catch (error) {
    console.error("Error in handleGenericChatStream:", error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error during chat processing';
    onChunk(`\nError: ${errorMsg}`);
    if (taskId && updateTask) {
      updateTask({ id: taskId, status: 'error', description: errorMsg });
    }
    return { success: false, error: error instanceof Error ? error : new Error(errorMsg) };
  }
}


// --- Stream Processing Helpers Removed (Moved to streamingUtils.ts) ---

