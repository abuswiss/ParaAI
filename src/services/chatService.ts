import { supabase } from '../lib/supabaseClient';
import { 
  addMessageSafely, 
  createConversationSafely, 
  getConversationSafely, 
  getConversationMessagesSafely 
} from '../lib/secureDataClient';
import { v4 as uuidv4 } from 'uuid';
import { DispatcherResponse } from '../lib/taskDispatcher'; 
import { SourceInfo } from '@/types/sources'; 
import { analyzeDocument as analyzeDocumentService } from './documentAnalysisService';
import { type TaskStatus } from '@/atoms/appAtoms'; 

/**
 * Interface for a chat message
 */
export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/**
 * Interface for a conversation
 */
export interface Conversation {
  id: string;
  title: string;
  caseId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Represents a source snippet, e.g., from a web search.
 */
export interface Snippet {
  title: string;
  url: string;
  content?: string; 
  date?: string;
}

/**
 * Represents a source, potentially aliasing Snippet if structure is identical.
 */
export type Source = Snippet; 

/**
 * Create a new conversation
 */
export const createConversation = async (
  caseId: string,
  title?: string
): Promise<{ data: Conversation | null; error: Error | null }> => {
  try {
    return await createConversationSafely(caseId, title);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error creating conversation';
    console.error('Error creating conversation:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Get a conversation by ID
 */
export const getConversation = async (
  conversationId: string
): Promise<{ data: Conversation | null; error: Error | null }> => {
  try {
    return await getConversationSafely(conversationId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error getting conversation';
    console.error('Error getting conversation:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Get all conversations for the current user
 */
export const getUserConversations = async (): Promise<{
  data: Conversation[] | null;
  error: Error | null;
}> => {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user?.id) {
      return { data: null, error: new Error('User not authenticated') };
    }

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('owner_id', user.user.id) 
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error getting user conversations:', error);
      return { data: null, error };
    }

    return {
      data: data.map((conv) => ({
        id: conv.id,
        title: conv.title,
        caseId: conv.case_id,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
      })),
      error: null,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error getting user conversations';
    console.error('Error getting user conversations:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Get messages for a conversation
 */
export const getConversationMessages = async (
  conversationId: string
): Promise<{ data: ChatMessage[] | null; error: Error | null }> => {
  try {
    return await getConversationMessagesSafely(conversationId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error getting messages';
    console.error('Error getting messages:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Add a message to a conversation
 */
export const addMessage = async (
  conversationId: string,
  role: 'system' | 'user' | 'assistant',
  content: string
): Promise<{ data: ChatMessage | null; error: Error | null }> => {
  try {
    const result = await addMessageSafely(conversationId, role, content);
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error adding message';
    console.error('Error adding message:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Sends a message, potentially creates a conversation, and streams the AI response,
 * using the chat-rag backend function for context retrieval if documentId is provided.
 */
export const sendMessageStream = async (
  conversationId: string | null | undefined,
  message: string,
  onChunk: (chunk: string) => void,
  caseId: string,
  documentId?: string,
): Promise<{ success: boolean; error: Error | null; newConversationId?: string }> => {
  let actualConversationId = conversationId;
  let newConversationCreated = false;

  try {
    if (!actualConversationId) {
      console.log('No conversationId provided, creating new conversation...');
      const { data: newConv, error: createError } = await createConversationSafely(caseId);
      if (createError || !newConv) {
        throw createError || new Error('Failed to create new conversation.');
      }
      actualConversationId = newConv.id;
      newConversationCreated = true;
      console.log(`New conversation created with ID: ${actualConversationId}`);
    }

    const { data: historyData, error: historyError } = await getConversationMessagesSafely(actualConversationId);
    if (historyError) {
      console.warn('Could not fetch conversation history:', historyError.message);
    }
    const conversationHistory = (historyData || []).map(msg => ({
        role: msg.role,
        content: msg.content
    })).slice(-10); 

    const { error: userMessageError } = await addMessageSafely(actualConversationId, 'user', message);
    if (userMessageError) {
      console.error('Failed to save user message:', userMessageError);
    }

    const invokePayload = {
        message,
        conversationHistory,
        documentId
    };

    console.log(`Invoking chat-rag function for convo ${actualConversationId}, docId: ${documentId}`);

    const { data: responseData, error: invokeError } = await supabase.functions.invoke('chat-rag', {
        body: invokePayload,
    });

    if (invokeError) throw invokeError;
    if (!responseData) throw new Error('Function invocation returned no data.');

    let stream: ReadableStream<Uint8Array>;
    if (responseData instanceof Blob) {
        stream = responseData.stream();
    } else if (responseData instanceof ReadableStream) {
        stream = responseData;
    } else {
        console.error('Unexpected response type from function invocation:', typeof responseData);
        throw new Error('Unexpected response type received from chat function.');
    }

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let accumulatedResponse = '';
    let done = false;

    const assistantMessageId = uuidv4();
    const { error: initialAssistantError } = await addMessageSafely(
        actualConversationId,
        'assistant',
        '...' 
    );
    if (initialAssistantError) {
        console.error('Failed to save initial placeholder assistant message:', initialAssistantError);
    }

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        for (const line of lines) {
            if (line.startsWith('data:')) {
                const dataContent = line.substring(5).trim();
                if (dataContent === '[DONE]') {
                    done = true;
                    break;
                }
                try {
                   const parsedChunk = JSON.parse(dataContent);
                   const content = parsedChunk.choices?.[0]?.delta?.content || '';
                   if (content) {
                       accumulatedResponse += content;
                       onChunk(content);
                   }
                } catch (e) {
                    console.warn('Could not parse stream chunk as JSON:', dataContent, e); 
                }
            } else {
                 console.warn('Received non-SSE line:', line);
            }
        }
      }
    }

    console.log(`Stream finished for convo ${actualConversationId}. Full response length: ${accumulatedResponse.length}`);

    if (assistantMessageId && accumulatedResponse.trim()) {
        const { error: updateError } = await supabase
            .from('messages')
            .update({ content: accumulatedResponse.trim() })
            .eq('id', assistantMessageId);

        if (updateError) {
            console.error(`Failed to update final assistant message (ID: ${assistantMessageId}):`, updateError);
        } else {
             console.log(`Successfully updated assistant message (ID: ${assistantMessageId})`);
        }
    } else if (!accumulatedResponse.trim()) {
         console.warn(`Assistant response was empty for convo ${actualConversationId}, placeholder not updated.`);
    }

    return {
      success: true,
      error: null,
      newConversationId: newConversationCreated ? actualConversationId : undefined,
    };

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error in sendMessageStream';
    console.error('Error sending message stream:', msg);
    return {
      success: false,
      error: error instanceof Error ? error : new Error(msg),
      newConversationId: newConversationCreated && actualConversationId ? actualConversationId : undefined,
    };
  }
};

/**
 * Link a document to a conversation for context
 */
export const addDocumentToConversation = async (
  conversationId: string,
  documentId: string
): Promise<{ success: boolean; error: Error | null }> => {
  try {
    const { error } = await supabase.from('document_context').insert({
      conversation_id: conversationId,
      document_id: documentId,
    });

    if (error) {
      throw error;
    }

    return { success: true, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error adding document to conversation';
    console.error('Error adding document to conversation:', message);
    return { success: false, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Handle a /research query using the courtlistener-rag Supabase Edge Function
 */
export const handleResearchQueryStream = async (
  researchQuery: string,
  onChunk: (chunk: string) => void
): Promise<DispatcherResponse> => {
  console.log(`Handling Research Query (via Streaming Edge Function): "${researchQuery}"`);
  let sources: SourceInfo[] | undefined;

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
      }
  );

  return { 
      success: streamResult.success, 
      error: streamResult.error, 
      sources: sources 
  };
};

/**
 * Define types for task update/remove functions (matching TaskDispatcherParams)
 */
type UpdateTaskFn = (update: { id: string; status?: TaskStatus; progress?: number; description?: string }) => void;
type RemoveTaskFn = (taskId: string) => void;

/**
 * Handle a /agent draft query using the 'agent-draft' Supabase Edge function
 */
export const handleAgentDraftStream = async (
  instructions: string,
  onChunk: (chunk: string) => void,
  caseId?: string, 
  documentContext?: string,
  analysisContext?: string,
  taskId?: string, 
  updateTask?: UpdateTaskFn, 
  removeTask?: RemoveTaskFn
): Promise<{ success: boolean; error: Error | null; answer?: string }> => {
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

  try {
    const payload: Record<string, any> = {
      instructions,
      caseId,
      documentContext,
      analysisContext,
      userId,
    };

    // Use the processSupabaseStream helper
    const result = await processSupabaseStream('agent-draft', payload, onChunk);
    if (result.success) {
      if (taskId && updateTask) updateTask({ id: taskId, status: 'success', description: 'Draft complete' }); 
      return { success: true, error: null, answer: result.fullResponse };
    } else {
      if (taskId && updateTask) updateTask({ id: taskId, status: 'error', description: `Draft failed: ${result.error?.message}` }); 
      return { success: false, error: result.error, answer: undefined };
    }
  } catch (error) {
    console.error('Error in handleAgentDraftStream:', error);
    onChunk(`Error drafting: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (taskId && updateTask) updateTask({ id: taskId, status: 'error', description: `Draft failed: ${error instanceof Error ? error.message : 'Unknown error'}` }); 
    return { success: false, error: error instanceof Error ? error : new Error('Unknown draft error'), answer: undefined };
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
    const payload: Record<string, any> = {
      docId,
      clause,
      userId,
    };

    // Use the processSupabaseStream helper
    const result = await processSupabaseStream('find-clause', payload, onChunk);
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
    const payload: Record<string, any> = {
      term,
      jurisdiction,
      caseId,
    };

    // Use the processSupabaseStream helper
    const result = await processSupabaseStream('explain-term', payload, onChunk);
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
    const payload: Record<string, any> = {
      caseId,
      documentContexts: docIds,
      analysisContext,
      userId,
    };

    // Use the processSupabaseStream helper
    const result = await processSupabaseStream('compare-documents', payload, onChunk);
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

/**
 * Handle a /agent flag_privileged_terms query using OpenAI
 * 1. Fetch the document by ID
 * 2. Extract the text
 * 3. Build a prompt for OpenAI to flag terms
 * 4. Stream the response
 */
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
    const terms = (data as any)?.result; 
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
  conversationId: string, 
  params: { query: string; model?: string },
  onChunk: (chunk: string) => void,
  taskId?: string, 
  updateTask?: UpdateTaskFn, 
  removeTask?: RemoveTaskFn
): Promise<DispatcherResponse> => {
  console.log(`Handling Perplexity Agent (via Streaming Edge Function) for conv: ${conversationId}, query: ${params.query}`);
  
  try {
    const { query, model = 'llama-3-sonar-large-32k-online' } = params;
    const payload = {
      query,
      model,
    };

    // Use the processSupabaseStream helper
    const result = await processSupabaseStream('perplexity-search', payload, onChunk);
    if (result.success) {
      if (taskId && updateTask) updateTask({ id: taskId, status: 'success', description: 'Perplexity query complete' }); 
      return { success: true, sources: result.sources as SourceInfo[] | undefined };
    } else {
      if (taskId && updateTask) updateTask({ id: taskId, status: 'error', description: `Perplexity query failed: ${result.error?.message}` }); 
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('Error calling perplexity-agent function:', error);
    onChunk(`Error processing Perplexity query: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (taskId && updateTask) updateTask({ id: taskId, status: 'error', description: `Perplexity query failed: ${error instanceof Error ? error.message : 'Unknown error'}` }); 
    return { success: false, error: error instanceof Error ? error : new Error('Unknown Perplexity agent error') };
  } finally {
    if (taskId && removeTask) removeTask(taskId); 
  }
}; 

/**
 * Handle a /agent flag_privileged_terms query using OpenAI
 * 1. Fetch the document by ID
 * 2. Extract the text
 * 3. Build a prompt for OpenAI to flag terms
 * 4. Stream the response
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
    const invokePayload = {
      textToRewrite: selectedText,
      instructions,
      surroundingContext,
    };

    const { data: responseData, error: invokeError } = await supabase.functions.invoke(
      'rewrite-text',
      {
        body: invokePayload,
      }
    );

    if (invokeError) throw invokeError;
    if (!(responseData instanceof ReadableStream)) {
        let errorMessage = 'Received non-stream response from rewrite-text function.';
        try {
            const errorJson = JSON.parse(await new Response(responseData).text());
            errorMessage = errorJson.error || errorMessage;
        } catch (e) { /* ignore parsing error */ }
        throw new Error(errorMessage);
    }

    const reader = responseData.getReader();
    const decoder = new TextDecoder();
    let accumulatedResponse = '';
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        for (const line of lines) {
             if (line.startsWith('data:')) {
                const dataContent = line.substring(5).trim();
                if (dataContent === '[DONE]') {
                    done = true;
                    break;
                }
                try {
                   const parsedChunk = JSON.parse(dataContent);
                   const content = parsedChunk.choices?.[0]?.delta?.content || '';
                   if (content) {
                       accumulatedResponse += content;
                       onChunk(content);
                   }
                } catch (e) {
                    console.warn('Could not parse stream chunk as JSON:', dataContent, e);
                }
            } else {
                 console.warn('Received non-SSE line:', line);
            }
        }
      }
    }

    console.log('Rewrite stream finished successfully.');
    if (taskId && updateTask) updateTask({ id: taskId, status: 'success', description: 'Rewrite complete' }); 
    return { success: true, error: null, answer: accumulatedResponse };
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
 * Handle a /agent flag_privileged_terms query using OpenAI
 * 1. Fetch the document by ID
 * 2. Extract the text
 * 3. Build a prompt for OpenAI to flag terms
 * 4. Stream the response
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
    const invokePayload = {
      textToSummarize: selectedText,
      instructions,
      surroundingContext,
    };

    const { data: responseData, error: invokeError } = await supabase.functions.invoke(
      'summarize-text',
      {
        body: invokePayload,
      }
    );

    if (invokeError) throw invokeError;
    if (!(responseData instanceof ReadableStream)) {
        let errorMessage = 'Received non-stream response from summarize-text function.';
        try {
            const errorJson = JSON.parse(await new Response(responseData).text());
            errorMessage = errorJson.error || errorMessage;
        } catch (e) { /* ignore parsing error */ }
        throw new Error(errorMessage);
    }

    const reader = responseData.getReader();
    const decoder = new TextDecoder();
    let accumulatedResponse = '';
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        for (const line of lines) {
             if (line.startsWith('data:')) {
                const dataContent = line.substring(5).trim();
                if (dataContent === '[DONE]') {
                    done = true;
                    break;
                }
                try {
                   const parsedChunk = JSON.parse(dataContent);
                   const content = parsedChunk.choices?.[0]?.delta?.content || '';
                   if (content) {
                       accumulatedResponse += content;
                       onChunk(content);
                   }
                } catch (e) {
                    console.warn('Could not parse stream chunk as JSON:', dataContent, e);
                }
            } else {
                 console.warn('Received non-SSE line:', line);
            }
        }
      }
    }

    console.log('Summarize stream finished successfully.');
    if (taskId && updateTask) updateTask({ id: taskId, status: 'success', description: 'Summarization complete' }); 
    return { success: true, error: null, answer: accumulatedResponse };
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
 * Helper for processing SSE Streams from Supabase Functions
 */
async function processSupabaseStream(
    functionName: string,
    payload: Record<string, unknown>,
    onChunk: (chunk: string) => void,
    onSnippets?: (snippets: SourceInfo[]) => void, 
    onError?: (errorMessage: string) => void
): Promise<{ success: boolean; error: Error | null; fullResponse: string; sources?: SourceInfo[] }> {
    let accumulatedResponse = '';
    let receivedSources: SourceInfo[] | undefined = undefined;
    try {
        console.log(`Invoking streaming function: ${functionName}`);
        const { data: responseData, error: invokeError } = await supabase.functions.invoke(functionName, {
            body: payload,
        });

        if (invokeError) throw invokeError;
        if (!responseData) throw new Error('Function invocation returned no data.');

        const stream = responseData.stream();
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; 

            for (const line of lines) {
                if (line.trim() === '') continue; 

                if (line.startsWith('event:')) {
                    const eventType = line.substring(6).trim();
                    const nextLineIndex = lines.indexOf(line) + 1;
                    if (nextLineIndex < lines.length && lines[nextLineIndex].startsWith('data:')) {
                        const dataContent = lines[nextLineIndex].substring(5).trim();
                        try {
                            const jsonData = JSON.parse(dataContent);
                            if (eventType === 'snippets' && onSnippets) {
                                receivedSources = jsonData as SourceInfo[]; 
                                onSnippets(receivedSources);
                            } else if (eventType === 'answer') {
                                const chunk = jsonData; 
                                if (typeof chunk === 'string') {
                                     accumulatedResponse += chunk;
                                     onChunk(chunk);
                                }
                            } else if (eventType === 'error') {
                                const errorMessage = jsonData.message || 'Unknown stream error';
                                console.error(`Stream error event from ${functionName}:`, errorMessage);
                                if (onError) onError(errorMessage);
                            } else if (eventType === 'done') {
                                console.log(`Received 'done' event from ${functionName}`);
                            }
                        } catch (e) {
                            console.warn(`Failed to parse SSE data line as JSON: ${dataContent}`, e);
                        }
                    }
                } else if (line.startsWith('data:')) {
                    const dataContent = line.substring(5).trim();
                     try {
                         const chunk = JSON.parse(dataContent);
                         const textChunk = typeof chunk === 'string' ? chunk : chunk.choices?.[0]?.delta?.content || '';
                         if (textChunk) {
                            accumulatedResponse += textChunk;
                            onChunk(textChunk);
                         }
                     } catch (e) {
                         console.warn('Could not parse standard data line as JSON, treating as raw:', dataContent);
                     }
                }
            }
        }
        
        console.log(`Stream finished for ${functionName}. Full response length: ${accumulatedResponse.length}`);
        return { success: true, error: null, fullResponse: accumulatedResponse, sources: receivedSources }; 
    } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(`Unknown error processing stream for ${functionName}`);
        console.error(error.message, e);
        if (onError) onError(error.message);
        return { success: false, error, fullResponse: accumulatedResponse, sources: receivedSources };
    }
}

/**
 * Handle Summarize action (non-streaming)
 */
export const summarizeTextSimple = async (
  selectedText: string,
  instructions?: string,
  surroundingContext?: string
): Promise<string> => {
  console.log(`Invoking summarize-text function (non-streaming)`);
  const invokePayload = {
    textToSummarize: selectedText,
    instructions,
    surroundingContext,
    stream: false // Add flag to request non-streaming response (needs function support)
  };

  const { data, error } = await supabase.functions.invoke(
    'summarize-text',
    {
      body: invokePayload,
    }
  );

  if (error) {
    console.error('Error invoking summarize-text:', error);
    throw new Error(error.message || 'Failed to summarize text.');
  }

  // Assuming the function returns { result: string } when stream: false
  if (data && typeof data.result === 'string') { 
    return data.result;
  } else {
     // Fallback or handle unexpected response
     console.error('Unexpected response from summarize-text:', data);
     // Attempt to parse if it looks like a stream error message
     try {
        const errorJson = JSON.parse(await new Response(data).text());
        throw new Error(errorJson.error || 'Invalid response from summarize function.');
     } catch (e) {
        throw new Error('Invalid response from summarize function.');
     }
  }
};

/**
 * Handle Rewrite action (non-streaming)
 */
export const rewriteTextSimple = async (
  selectedText: string,
  instructions?: string,
  surroundingContext?: string,
  mode?: 'improve' | 'shorten' | 'expand' | 'professional' | 'formal' | 'simple' | 'custom' 
): Promise<string> => {
  console.log(`Invoking rewrite-text function (non-streaming) with mode: ${mode || 'improve'}`);
  const invokePayload = {
    textToRewrite: selectedText,
    instructions,
    surroundingContext,
    mode: mode || 'improve',
    stream: false 
  };

  const { data, error } = await supabase.functions.invoke(
    'rewrite-text',
    {
      body: invokePayload,
    }
  );

  if (error) {
    console.error('Error invoking rewrite-text:', error);
    throw new Error(error.message || 'Failed to rewrite text.');
  }
  
  if (data && typeof data.result === 'string') { 
    return data.result;
  } else {
     console.error('Unexpected response from rewrite-text:', data);
      try {
        const errorJson = JSON.parse(await new Response(data).text());
        throw new Error(errorJson.error || 'Invalid response from rewrite function.');
     } catch (e) {
        throw new Error('Invalid response from rewrite function.');
     }
  }
};
