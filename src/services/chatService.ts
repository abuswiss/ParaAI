import { openai } from '../lib/openaiClient';
import { supabase } from '../lib/supabaseClient';
import { 
  addMessageSafely, 
  createConversationSafely, 
  getConversationSafely, 
  getConversationMessagesSafely 
} from '../lib/secureDataClient';
import { v4 as uuidv4 } from 'uuid';
import { DocumentAnalysisResult } from './documentAnalysisService';

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
  content: string;
  // Add other relevant fields if needed
}

/**
 * Represents a source, potentially aliasing Snippet if structure is identical.
 */
export type Source = Snippet; // Alias for now, can be made distinct later

/**
 * Placeholder interface for the task object in handleAgentCompareStream.
 * TODO: Define the actual structure based on usage.
 */
export interface ComparisonTask {
  // Define expected properties of the comparison task object
  [key: string]: unknown; // Allow any properties for now
}

/**
 * Represents the expected structure of the response from the /api/research endpoint.
 */
interface ResearchApiResponse {
  success: boolean;
  answer?: string;
  snippets?: Snippet[]; // Use the existing Snippet interface
  error?: string;
}

/**
 * Create a new conversation
 */
export const createConversation = async (
  title?: string,
  caseId?: string
): Promise<{ data: Conversation | null; error: Error | null }> => {
  try {
    // Use the secure client to avoid RLS recursive policy issues
    return await createConversationSafely(title, caseId);
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
    // Use the secure client to avoid RLS recursive policy issues
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

    // Direct query to get conversations without triggering RLS recursion
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('owner_id', user.user.id) // Using owner_id as per the database schema
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
    // Use the secure client to avoid RLS recursive policy issues
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
    // Use the secure client to avoid RLS recursive policy issues
    const result = await addMessageSafely(conversationId, role, content);
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error adding message';
    console.error('Error adding message:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Send a message to the OpenAI API and get a response
 * Uses streaming for better user experience
 */
export const sendMessageStream = async (
  conversationId: string | null | undefined,
  message: string,
  onChunk: (chunk: string) => void,
  documentContext?: string,
  analysisContext?: string,
  caseId?: string
): Promise<{ success: boolean; error: Error | null; newConversationId?: string }> => {
  console.log(`Starting sendMessageStream with conversationId: ${conversationId || 'null'}`);
  try {
    // Check if we need to create a conversation 
    let actualConversationId = conversationId;
    let newConversationCreated = false;
    
    if (!actualConversationId || actualConversationId === 'new') {
      // Create a new conversation
      console.log('Creating new conversation for message');
      const { data: newConversation, error: createError } = await createConversationSafely('New Conversation');
      
      if (createError) {
        console.error('Failed to create conversation for message:', createError);
        return { 
          success: false, 
          error: new Error(`Failed to create conversation: ${createError.message}`) 
        };
      }
      
      if (!newConversation) {
        console.error('Failed to create conversation: No data returned');
        return { 
          success: false, 
          error: new Error('Failed to create conversation: No data returned') 
        };
      }
      
      actualConversationId = newConversation.id;
      newConversationCreated = true;
      console.log('Created new conversation with ID:', actualConversationId);
    }
    
    // Verify we have a valid conversation ID before continuing
    if (!actualConversationId) {
      console.error('No valid conversation ID for message');
      return { 
        success: false, 
        error: new Error('No valid conversation ID for message') 
      };
    }

    console.log(`Adding user message to conversation: ${actualConversationId}`);
    // Add user message to the database with the valid conversation ID
    const userMsgResult = await addMessageSafely(
      actualConversationId,
      'user',
      message
    );

    if (userMsgResult.error) {
      console.error('Error adding user message:', userMsgResult.error);
      return { 
        success: false, 
        error: userMsgResult.error 
      };
    }

    // Get conversation history
    // Default to empty history if there's an error
    let history: ChatMessage[] = [];
    
    // Now that we have a valid conversation ID, try to get its history
    console.log(`Fetching conversation history for: ${actualConversationId}`);
    const { data, error } = await getConversationMessages(actualConversationId);
    if (error) {
      console.warn('Could not fetch conversation history:', error);
      // Continue without history rather than throwing
    } else if (data) {
      history = data;
      console.log(`Found ${data.length} messages in history`);
    }

    // Format messages for OpenAI
    const messages = (history || []).map((msg) => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }));
    
    // Add initial system message if there isn't one
    if (messages.length === 0 || messages[0].role !== 'system') {
      messages.unshift({
        role: 'system',
        content: 'You are the Paralegal AI Assistant, a helpful AI trained to assist with legal matters.'
      });
    }

    // Add document context if provided
    if (documentContext) {
      messages.unshift({
        role: 'system',
        content: `The following is relevant document context that may help with the user's query: ${documentContext}`,
      });
    }
    
    // Add analysis context if provided
    if (analysisContext) {
      try {
        // Use the imported type for parsing
        const analysis: DocumentAnalysisResult = JSON.parse(analysisContext);
        const analysisType = analysis.analysisType || 'document';
        let formattedAnalysis = '';
        
        // Format the analysis based on its type
        switch (analysisType) {
          case 'summary':
            formattedAnalysis = `Summary of the document provided: ${analysis.result || 'Not available'}`;
            break;
          case 'risks':
            formattedAnalysis = `Potential risks identified in the document: ${analysis.result || 'None found or analysis unavailable'}`;
            break;
          case 'clauses':
            formattedAnalysis = `Key clauses identified: ${analysis.result || 'None found or analysis unavailable'}`;
            break;
          default:
            formattedAnalysis = `Analysis result provided: ${analysis.result || 'Content unavailable'}`;
        }
        
        messages.unshift({
          role: 'system',
          content: `Relevant Analysis Context:\n${formattedAnalysis}`
        });
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error('Unknown error parsing or formatting analysis context');
        console.error('Failed to parse or format analysis context:', error.message);
        messages.unshift({
          role: 'system',
          content: '[System Note: Provided analysis context could not be processed.]'
        });
      }
    }

    // Add case context if provided
    if (caseId) {
        messages.unshift({
            role: 'system',
            content: `Current Case Context ID: ${caseId}`
        });
    }

    // Add a default system message if there isn't one
    if (!messages.some((msg) => msg.role === 'system')) {
      messages.unshift({
        role: 'system',
        content: 'You are a helpful legal assistant. Provide accurate and helpful information on legal documents and queries.',
      });
    }

    // Create initial message in the DB for the assistant's response
    const assistantMessageId = uuidv4();
    const { error: initialAssistantError } = await supabase
      .from('messages')
      .insert({
        id: assistantMessageId,
        conversation_id: actualConversationId,
        role: 'assistant',
        content: '', // Will be updated as we get chunks
      });

    if (initialAssistantError) {
      throw initialAssistantError;
    }

    // Create stream
    const stream = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      stream: true,
      temperature: 0.1, // Lower temperature for more factual responses with legal content
    });

    let fullResponse = '';

    // Process the stream
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        onChunk(content);
      }
    }

    // Update the assistant message with the full response
    const { error: updateError } = await supabase
      .from('messages')
      .update({ content: fullResponse })
      .eq('id', assistantMessageId);

    if (updateError) {
      throw updateError;
    }

    // Update the conversation's updated_at timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', actualConversationId);

    // Return success with the new conversation ID if one was created
    return { 
      success: true, 
      error: null,
      newConversationId: newConversationCreated ? actualConversationId : undefined 
    };
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error('Unknown error sending message');
    console.error('Error in sendMessageStream:', error.message, e); // Log original error too
    return { success: false, error };
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
 * Handle a /research query using RAG (Retrieval-Augmented Generation)
 * 1. Fetch relevant legal documents/snippets from CourtListener
 * 2. Build a RAG prompt with those snippets and the user query
 * 3. Call OpenAI with the prompt
 * 4. Return the grounded answer
 */
export const handleResearchQueryStream = async (
  researchQuery: string,
  onChunk: (chunk: string) => void
): Promise<{ success: boolean; error: Error | null; answer?: string; snippets?: Snippet[] }> => {
  try {
    // Call the backend API instead of CourtListener directly
    const response = await fetch('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: researchQuery })
    });
    if (!response.ok) {
      throw new Error(`Backend /api/research error: ${response.status} ${response.statusText}`);
    }
    const data: ResearchApiResponse = await response.json();

    // Check for backend error reported in the response body
    if (!data.success && data.error) {
        throw new Error(`Backend /api/research error: ${data.error}`);
    }

    // If OpenAI answer is present, stream it; otherwise, stream snippets as fallback
    if (data.answer) {
      onChunk(data.answer);
      return { success: true, error: null, answer: data.answer, snippets: data.snippets };
    } else if (data.snippets) {
      // Fallback: stream snippets as a single chunk
      const snippetText = data.snippets.map((s: Snippet) => s.content || '').join('\n---\n');
      onChunk(snippetText);
      return { success: true, error: null, snippets: data.snippets };
    } else {
      throw new Error('No answer or snippets returned from backend');
    }
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error('Unknown error in research query');
    console.error('Error in handleResearchQueryStream:', error.message, e); // Log original error too
    return { success: false, error };
  }
};

/**
 * Handle a /agent draft query using OpenAI
 * 1. Build a system prompt using the user's instructions and any document/analysis context
 * 2. Call OpenAI with the prompt
 * 3. Stream the response
 */
export const handleAgentDraftStream = async (
  instructions: string,
  onChunk: (chunk: string) => void,
  documentContext?: string,
  analysisContext?: string
): Promise<{ success: boolean; error: Error | null; answer?: string }> => {
  try {
    // Build the system prompt for legal drafting
    let contextPrompt = '';
    if (documentContext) {
      contextPrompt += `Relevant document context:\n${documentContext}\n`;
    }
    if (analysisContext) {
      contextPrompt += `Relevant analysis context:\n${analysisContext}\n`;
    }
    const systemPrompt =
      'You are a paralegal AI assistant. Draft legal documents, emails, or letters as instructed. Use any provided context. Be clear, professional, and legally accurate.';
    const userPrompt = `${contextPrompt}\nDrafting instructions: ${instructions}`;

    const stream = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: true,
      temperature: 0.2,
    });

    let answer = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        answer += content;
        onChunk(content);
      }
    }
    return { success: true, error: null, answer };
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error('Unknown error in agent draft');
    console.error('Error in handleAgentDraftStream:', error.message, e); // Log original error too
    return { success: false, error };
  }
};

/**
 * Handle a /find-clause query using OpenAI
 * 1. Fetch the document by ID
 * 2. Extract the text
 * 3. Build a prompt for OpenAI to find the clause
 * 4. Stream the response
 */
export const handleFindClauseStream = async (
  clause: string,
  docId: string,
  onChunk: (chunk: string) => void
): Promise<{ success: boolean; error: Error | null; answer?: string }> => {
  try {
    // Import here to avoid circular dependency
    const { getDocumentById } = await import('./documentService');
    const { data: document, error: docError } = await getDocumentById(docId);
    if (docError || !document) {
      throw docError || new Error('Document not found');
    }
    if (!document.extractedText) {
      throw new Error('Document text not available. Please wait for processing to complete.');
    }
    const systemPrompt =
      'You are a paralegal AI assistant. Given a legal document and a clause description, find and return the most relevant clause or section from the document. If no exact match is found, return the closest relevant text.';
    const userPrompt = `Document text:\n${document.extractedText}\n\nFind the clause: ${clause}`;

    const stream = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: true,
      temperature: 0.1,
    });

    let answer = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        answer += content;
        onChunk(content);
      }
    }
    return { success: true, error: null, answer };
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error('Unknown error finding clause');
    console.error('Error in handleFindClauseStream:', error.message, e); // Log original error too
    return { success: false, error };
  }
};

/**
 * Handle a /agent generate_timeline query using OpenAI
 * 1. Fetch the document by ID
 * 2. Extract the text
 * 3. Build a prompt for OpenAI to generate a timeline
 * 4. Stream the response as a Markdown list
 */
export const handleGenerateTimelineStream = async (
  docId: string,
  onChunk: (chunk: string) => void
): Promise<{ success: boolean; error: Error | null; answer?: string }> => {
  try {
    // Import here to avoid circular dependency
    const { getDocumentById } = await import('./documentService');
    const { data: document, error: docError } = await getDocumentById(docId);
    if (docError || !document) {
      throw docError || new Error('Document not found');
    }
    if (!document.extractedText) {
      throw new Error('Document text not available. Please wait for processing to complete.');
    }
    const systemPrompt =
      'You are a paralegal AI assistant. Given a legal document, extract a chronological timeline of key events. For each event, identify the date (if available) and provide a concise description. Format the output as a Markdown list, with each item starting with the date.';
    const userPrompt = `Document text:\n${document.extractedText}\n\nGenerate a timeline of key dates and events as a Markdown list.`;

    const stream = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: true,
      temperature: 0.1,
    });

    let answer = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        answer += content;
        onChunk(content);
      }
    }
    return { success: true, error: null, answer };
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error('Unknown error generating timeline');
    console.error('Error in handleGenerateTimelineStream:', error.message, e); // Log original error too
    return { success: false, error };
  }
};

/**
 * Handle a /agent explain_term query using OpenAI
 * 1. Build a prompt to define/explain the legal term or acronym
 * 2. Stream the response
 */
export const handleExplainTermStream = async (
  term: string,
  onChunk: (chunk: string) => void,
  jurisdiction?: string
): Promise<{ success: boolean; error: Error | null; answer?: string }> => {
  try {
    const systemPrompt =
      'You are a legal dictionary AI assistant. Given a legal term or acronym, provide a clear, concise definition or explanation in the context of US law unless another jurisdiction is specified.';
    const userPrompt = `Define or explain the following legal term${jurisdiction ? ` in the context of ${jurisdiction} law` : ' in the context of US law'}: ${term}`;

    const stream = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: true,
      temperature: 0.1,
    });

    let answer = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        answer += content;
        onChunk(content);
      }
    }
    return { success: true, error: null, answer };
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error('Unknown error explaining term');
    console.error('Error in handleExplainTermStream:', error.message, e); // Log original error too
    return { success: false, error };
  }
};

/**
 * Handle a /agent compare query using OpenAI
 * Accepts an array of document contexts or IDs, fetches their texts if needed, and builds a prompt for comparison.
 * Streams the response via onChunk.
 */
export const handleAgentCompareStream = async (
  task: ComparisonTask, // Use the defined interface
  onChunk: (chunk: string) => void,
  documentContexts?: string | string[],
  analysisContext?: string
): Promise<{ success: boolean; error: Error | null; answer?: string }> => {
  try {
    // Accepts either array of extracted texts or array of IDs
    let docTexts: string[] = [];
    if (Array.isArray(documentContexts)) {
      // If they look like IDs (short, no spaces), fetch their text
      for (const ctx of documentContexts) {
        if (ctx.length < 40 && !ctx.includes(' ')) {
          // Looks like an ID, fetch from DB
          const { getDocumentById } = await import('./documentService');
          const { data: doc, error } = await getDocumentById(ctx);
          if (error || !doc || !doc.extractedText) {
            docTexts.push(`[Document ${ctx}: could not fetch or extract text]`);
          } else {
            docTexts.push(doc.extractedText);
          }
        } else {
          // Looks like extracted text
          docTexts.push(ctx);
        }
      }
    } else if (typeof documentContexts === 'string') {
      docTexts = [documentContexts];
    } else {
      throw new Error('No document contexts provided for comparison.');
    }
    if (docTexts.length < 2) {
      throw new Error('At least two documents are required for comparison.');
    }
    // Build the system and user prompt
    let contextPrompt = '';
    docTexts.forEach((text, idx) => {
      contextPrompt += `Document ${idx + 1}:
${text.substring(0, 8000)}\n\n`;
    });
    if (analysisContext) {
      contextPrompt += `Relevant analysis context:\n${analysisContext}\n`;
    }
    const systemPrompt =
      'You are a paralegal AI assistant. Compare the following legal documents. Highlight similarities, differences, and any notable legal issues. Be concise and use bullet points or tables where helpful.';
    const userPrompt = `${contextPrompt}\nCompare the above documents as requested by the user.`;
    const stream = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: true,
      temperature: 0.2,
    });
    let answer = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        answer += content;
        onChunk(content);
      }
    }
    return { success: true, error: null, answer };
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error('Unknown error in agent comparison');
    console.error('Error in handleAgentCompareStream:', error.message, e); // Log original error too
    return { success: false, error };
  }
};

/**
 * Handle a /agent flag_privileged_terms query using OpenAI
 * Scans a document for keywords/phrases associated with attorney-client privilege or work product.
 * Streams the response via onChunk.
 */
export const handleFlagPrivilegedTermsStream = async (
  docId: string,
  onChunk: (chunk: string) => void
): Promise<{ success: boolean; error: Error | null; answer?: string }> => {
  console.log(`Starting handleFlagPrivilegedTermsStream for docId: ${docId}`);
  try {
    // Simulate streaming for immediate feedback
    onChunk('Analyzing document for potentially privileged terms...\n\n');
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate work
    
    // Call backend document analysis service
    const { analyzeDocument } = await import('./documentAnalysisService');
    const { data, error } = await analyzeDocument(docId, 'privilegedTerms');
    
    if (error || !data) {
      console.error('Error flagging privileged terms:', error);
      onChunk(`Error: Unable to analyze document for privileged terms. ${error?.message || 'Unknown error'}`);
      return { success: false, error: error || new Error('Unknown error') };
    }

    let result = 'Analysis complete.\n\n';
    if (data.result && Array.isArray(data.result) && data.result.length > 0) {
      result += 'Potentially Privileged Terms Found:\n';
      data.result.forEach((term, index) => {
        result += `${index + 1}. ${term}\n`;
      });
      result += '\nPlease review these terms in context to confirm privilege.';
    } else {
      result += 'No potentially privileged terms were automatically detected.';
    }
    
    onChunk(result);
    console.log('Flag privileged terms analysis complete.');
    return { success: true, error: null, answer: result };

  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error('Unknown error flagging privileged terms');
    console.error('Error handling flag privileged terms:', error.message, e); // Log original error too
    const errorMessage = error instanceof Error ? error.message : 'Unknown error flagging privileged terms';
    onChunk(`Error: An unexpected error occurred while flagging terms. ${errorMessage}`);
    return { success: false, error };
  }
};

/**
 * Handle Perplexity agent tasks by invoking the Supabase Edge Function.
 */
export const handlePerplexityAgent = async (
  conversationId: string, // Keep conversationId if needed for context/history
  params: { query: string },
  onChunk: (chunk: string) => void
): Promise<{ success: boolean; error: Error | null; sources?: Source[] }> => {
  console.log(`Invoking Perplexity agent for conversation ${conversationId} with query: ${params.query}`);
  
  try {
    onChunk('Asking Perplexity AI...\n'); // Initial feedback
    
    // TODO: Fetch conversation history if needed for context
    // const { data: history, error: historyError } = await getConversationMessages(conversationId);
    // if (historyError) {
    //   console.warn('Could not fetch history for Perplexity:', historyError);
    // }

    // Invoke the Supabase Function
    const { data, error } = await supabase.functions.invoke('perplexity-agent', {
      body: { 
        query: params.query,
        // conversationHistory: history // Pass history if fetched
      },
    });

    if (error) {
      console.error('Error invoking Perplexity Edge Function:', error);
      throw new Error(`Failed to call Perplexity agent: ${error.message}`);
    }

    if (data.error) {
      console.error('Error returned from Perplexity Edge Function:', data.error);
      throw new Error(`Perplexity agent failed: ${data.error}`);
    }

    // Process the response
    const answer = data.answer || 'Perplexity did not provide an answer.';
    const sources = data.sources || [];
    
    onChunk(answer); // Send the full answer as one chunk for now
    
    // If sources exist, format them
    if (sources.length > 0) {
      let sourcesText = '\n\nSources:\n';
      sources.forEach((src: { url?: string, title?: string }, i: number) => {
        sourcesText += `${i + 1}. ${src.title || 'Source'}${src.url ? ` (${src.url})` : ''}\n`;
      });
      onChunk(sourcesText); // Send sources as a separate chunk (or append)
    }

    console.log('Perplexity agent execution successful.');
    return { success: true, error: null, sources: sources };

  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error('Unknown error in Perplexity agent');
    console.error('Error handling Perplexity agent:', error.message, e);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    onChunk(`Error interacting with Perplexity: ${errorMessage}`);
    return { success: false, error: error instanceof Error ? error : new Error(errorMessage) };
  }
};

/**
 * Handle a case-wide document search query.
 * Fetches documents related to the case and performs a search.
 */
export const handleCaseSearch = async (
  caseId: string,
  query: string,
  onChunk: (chunk: string) => void
): Promise<{ success: boolean; error: Error | null; answer?: string }> => {
  console.log(`Handling case search for caseId: ${caseId} with query: "${query}"`);
  try {
    // 1. Fetch document IDs for the given caseId
    onChunk('[{"type": "status", "message": "Fetching documents for the case..."}]');
    const { data: caseDocuments, error: docError } = await supabase
      .from('case_documents')
      .select('document_id')
      .eq('case_id', caseId);

    if (docError) {
      console.error('Error fetching case documents:', docError);
      onChunk(`[{"type": "error", "message": "Error fetching documents: ${docError.message}"}]`);
      return { success: false, error: docError };
    }

    if (!caseDocuments || caseDocuments.length === 0) {
      console.log('No documents found for this case.');
      onChunk('[{"type": "info", "message": "No documents found for this case to search."}]');
      // Return success with a message and null error
      return { success: true, answer: "No documents found for this case to search.", error: null };
    }

    const documentIds = caseDocuments.map(doc => doc.document_id);
    console.log(`Found ${documentIds.length} documents for case ${caseId}:`, documentIds);

    // 2. Fetch content for each document ID
    onChunk(`[{"type": "status", "message": "Fetching content for ${documentIds.length} document(s)..."}]`);
    
    // Use Promise.all to fetch all document contents concurrently
    const contentPromises = documentIds.map(async (docId) => {
      const { data: documentData, error: contentError } = await supabase
        .from('documents')
        .select('content, name') // Select content and name
        .eq('id', docId)
        .single(); // Expect only one document per ID

      if (contentError) {
        console.error(`Error fetching content for document ${docId}:`, contentError);
        // Decide how to handle partial failures. For now, we'll skip this document.
        // Could also throw an error to fail the whole search or return partial results.
        return null; 
      }
      if (!documentData) {
        console.warn(`No content found for document ${docId}. Skipping.`);
        return null;
      }
      // Return an object with name and content
      return { name: documentData.name || `Document ${docId}`, content: documentData.content };
    });

    const documentContents = (await Promise.all(contentPromises)).filter(doc => doc !== null) as { name: string, content: string }[]; // Filter out nulls

    if (documentContents.length === 0) {
      console.log('No content could be fetched for any of the documents.');
      onChunk(`[{"type": "info", "message": "Could not fetch content for the case documents."}]`);
      return { success: true, answer: "Could not fetch content for the case documents.", error: null };
    }

    console.log(`Successfully fetched content for ${documentContents.length} documents.`);

    // 3. Combine content
    let combinedContext = '';
    documentContents.forEach(doc => {
        // Add document name as a header for clarity
        combinedContext += `--- Document: ${doc.name} ---\n\n`;
        combinedContext += `${doc.content}\n\n`; // Add content, ensure separation
    });
    
    // Limit combined context size if necessary (e.g., for token limits)
    const MAX_CONTEXT_LENGTH = 100000; // Example limit, adjust as needed
    if (combinedContext.length > MAX_CONTEXT_LENGTH) {
        console.warn(`Combined context length (${combinedContext.length}) exceeds limit (${MAX_CONTEXT_LENGTH}). Truncating.`);
        combinedContext = combinedContext.substring(0, MAX_CONTEXT_LENGTH);
        onChunk(`[{"type": "warning", "message": "Combined document content is very large and has been truncated."}]`);
    }

    // 4. Construct prompt and call OpenAI
    onChunk(`[{"type": "status", "message": "Searching documents with AI..."}]`);

    const systemPrompt = `You are a paralegal AI assistant. You are given a collection of documents related to a specific case, marked with '--- Document: [Document Name] ---'. Search through these documents to find information relevant to the user's query. Summarize your findings clearly. When possible, indicate which document(s) (using their names) contain the relevant information.`;

    const userPrompt = `Case Document Context:
${combinedContext}

User Query: ${query}

Based *only* on the provided Case Document Context, find and summarize the information relevant to the User Query. Cite the document names where the information is found.`;

    const stream = await openai.chat.completions.create({
      model: 'gpt-4', // Or consider 'gpt-4-turbo' if context is very large
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: true,
      temperature: 0.1, // Low temperature for factual search
    });

    // 5. Stream results via onChunk
    let fullResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        // Stream raw content chunks directly
        onChunk(content); 
      }
    }

    console.log(`Case search completed for caseId: ${caseId}`);
    return { success: true, answer: fullResponse, error: null };

  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error('Unknown error in case search');
    console.error('Error handling case search:', error.message, e); // Log original error too
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    onChunk(`[{"type": "error", "message": "Error during case search: ${errorMessage}"}]`);
    return { success: false, error: error instanceof Error ? error : new Error(errorMessage) };
  }
};

// TODO: SECURITY - Move OpenAI call to a secure backend API route for production
/**
 * Handles rewriting selected text using OpenAI stream.
 */
export const handleRewriteStream = async (
  selectedText: string,
  onChunk: (chunk: string) => void,
  surroundingContext?: string, // Optional context around the selection
  instructions?: string // Optional specific instructions (e.g., "make it more formal")
): Promise<{ success: boolean; error: Error | null; answer?: string }> => {
  console.log(`Starting handleRewriteStream`);
  let fullResponse = '';
  try {
    const systemPrompt = `You are an expert legal assistant AI. Rewrite the following text as instructed. Maintain the original meaning and context unless specified otherwise.`;

    let userMessageContent = `Rewrite the following text:
--- TEXT START ---
${selectedText}
--- TEXT END ---`;

    if (instructions) {
      userMessageContent += `\n\nInstructions: ${instructions}`;
    }

    if (surroundingContext) {
        userMessageContent += `\n\nFor context, here is the text surrounding the selection:
--- CONTEXT START ---
${surroundingContext}
--- CONTEXT END ---`;
    }

    const stream = await openai.chat.completions.create({
      model: 'gpt-4', // Or your preferred model
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessageContent },
      ],
      stream: true,
      temperature: 0.5, // Adjust temperature as needed for creativity vs. fidelity
    });

    for await (const part of stream) {
      const chunk = part.choices[0]?.delta?.content || '';
      fullResponse += chunk;
      onChunk(chunk);
    }

    console.log('Rewrite stream finished successfully.');
    return { success: true, error: null, answer: fullResponse };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error during rewrite stream';
    console.error('Error in handleRewriteStream:', message);
    // Pass a generic or specific error message back if needed
    onChunk(`\n\n--- ERROR ---\n${message}`); 
    return { success: false, error: error instanceof Error ? error : new Error(message) };
  }
};

// TODO: SECURITY - Move OpenAI call to a secure backend API route for production
/**
 * Handles summarizing selected text using OpenAI stream.
 */
export const handleSummarizeStream = async (
  selectedText: string,
  onChunk: (chunk: string) => void,
  surroundingContext?: string, // Optional context around the selection
  instructions?: string // Optional specific instructions (e.g., "summarize in one sentence")
): Promise<{ success: boolean; error: Error | null; answer?: string }> => {
  console.log(`Starting handleSummarizeStream`);
  let fullResponse = '';
  try {
    const systemPrompt = `You are an expert legal assistant AI. Summarize the following text concisely and accurately. Capture the main points and key information.`;

    let userMessageContent = `Summarize the following text:
--- TEXT START ---
${selectedText}
--- TEXT END ---`;

    if (instructions) {
      userMessageContent += `\n\nInstructions: ${instructions}`;
    }
    
    if (surroundingContext) {
        userMessageContent += `\n\nFor context, here is the text surrounding the selection:
--- CONTEXT START ---
${surroundingContext}
--- CONTEXT END ---`;
    }

    const stream = await openai.chat.completions.create({
      model: 'gpt-4', // Or your preferred model
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessageContent },
      ],
      stream: true,
      temperature: 0.3, // Lower temperature for more focused summaries
    });

    for await (const part of stream) {
      const chunk = part.choices[0]?.delta?.content || '';
      fullResponse += chunk;
      onChunk(chunk);
    }

    console.log('Summarize stream finished successfully.');
    return { success: true, error: null, answer: fullResponse };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error during summarize stream';
    console.error('Error in handleSummarizeStream:', message);
    // Pass a generic or specific error message back if needed
    onChunk(`\n\n--- ERROR ---\n${message}`); 
    return { success: false, error: error instanceof Error ? error : new Error(message) };
  }
};
