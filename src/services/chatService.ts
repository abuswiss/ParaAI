import { openai } from '../lib/openaiClient';
import { supabase } from '../lib/supabaseClient';
import { 
  addMessageSafely, 
  createConversationSafely, 
  getConversationSafely, 
  getConversationMessagesSafely 
} from '../lib/secureDataClient';
import { v4 as uuidv4 } from 'uuid';

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
  caseId?: string;
  createdAt: string;
  updatedAt: string;
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
  } catch (error) {
    console.error('Error creating conversation:', error);
    return { data: null, error: error as Error };
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
  } catch (error) {
    console.error('Error getting conversation:', error);
    return { data: null, error: error as Error };
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
  } catch (error) {
    console.error('Error getting user conversations:', error);
    return { data: null, error: error as Error };
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
  } catch (error) {
    console.error('Error getting messages:', error);
    return { data: null, error: error as Error };
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
  } catch (error) {
    console.error('Error adding message:', error);
    return { data: null, error: error as Error };
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
  analysisContext?: string
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
    const { error: userMsgError } = await addMessageSafely(
      actualConversationId,
      'user',
      message
    );

    if (userMsgError) {
      console.error('Error adding user message:', userMsgError);
      return { 
        success: false, 
        error: userMsgError 
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
        const analysis = JSON.parse(analysisContext);
        const analysisType = analysis.analysisType || 'document';
        let formattedAnalysis = '';
        
        // Format the analysis based on its type
        switch (analysisType) {
          case 'summary':
            formattedAnalysis = `Document Summary: ${analysis.summary || ''}`;
            break;
          case 'entities':
            formattedAnalysis = 'Identified Entities:\n' + 
              (analysis.entities || []).map((entity: any) => 
                `- ${entity.type}: ${entity.name} ${entity.description ? `(${entity.description})` : ''}`
              ).join('\n');
            break;
          case 'risks':
            formattedAnalysis = 'Identified Risks:\n' + 
              (analysis.risks || []).map((risk: any) => 
                `- ${risk.severity.toUpperCase()}: ${risk.description} ${risk.mitigation ? `Mitigation: ${risk.mitigation}` : ''}`
              ).join('\n');
            break;
          case 'timeline':
            formattedAnalysis = 'Document Timeline:\n' + 
              (analysis.timeline || []).map((event: any) => 
                `- ${event.date}: ${event.description}`
              ).join('\n');
            break;
          default:
            formattedAnalysis = JSON.stringify(analysis, null, 2);
        }
        
        messages.unshift({
          role: 'system',
          content: `The following document analysis may help with the user's query:\n${formattedAnalysis}`,
        });
      } catch (error) {
        console.error('Error parsing analysis context:', error);
      }
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
  } catch (error: any) {
    console.error('Error sending message:', error);
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
  } catch (error) {
    console.error('Error adding document to conversation:', error);
    return { success: false, error: error as Error };
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
): Promise<{ success: boolean; error: Error | null; answer?: string; snippets?: Array<any> }> => {
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
    const data = await response.json();
    // If OpenAI answer is present, stream it; otherwise, stream snippets as fallback
    if (data.answer) {
      onChunk(data.answer);
      return { success: true, error: null, answer: data.answer, snippets: data.snippets };
    } else if (data.snippets) {
      // Fallback: stream snippets as a single chunk
      const snippetText = data.snippets.map((s: any) => s.text || '').join('\n---\n');
      onChunk(snippetText);
      return { success: true, error: null, snippets: data.snippets };
    } else {
      throw new Error('No answer or snippets returned from backend');
    }
  } catch (error) {
    console.error('Error in handleResearchQueryStream:', error);
    return { success: false, error: error as Error };
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
  } catch (error) {
    console.error('Error in handleAgentDraftStream:', error);
    return { success: false, error: error as Error };
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
  } catch (error) {
    console.error('Error in handleFindClauseStream:', error);
    return { success: false, error: error as Error };
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
  } catch (error) {
    console.error('Error in handleGenerateTimelineStream:', error);
    return { success: false, error: error as Error };
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
  } catch (error) {
    console.error('Error in handleExplainTermStream:', error);
    return { success: false, error: error as Error };
  }
};

/**
 * Handle a /agent compare query using OpenAI
 * Accepts an array of document contexts or IDs, fetches their texts if needed, and builds a prompt for comparison.
 * Streams the response via onChunk.
 */
export const handleAgentCompareStream = async (
  task: any, // Should be typed more strictly in the future
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
  } catch (error) {
    console.error('Error in handleAgentCompareStream:', error);
    return { success: false, error: error as Error };
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
    // Predefined list of privileged terms/phrases
    const privilegedTerms = [
      'attorney-client privilege',
      'work product',
      'legal advice',
      'confidential communication',
      'prepared in anticipation of litigation',
      'subject to privilege',
      'privileged and confidential',
      'attorney work product',
      'do not disclose',
      'for the purpose of obtaining legal advice',
      'protected by privilege',
      'client communication',
      'counsel',
      'solicitor',
      'law firm',
      'legal department',
      'in-house counsel',
      'outside counsel',
      'confidential memorandum',
      'not for distribution',
      'privileged information',
      'confidential draft',
      'prepared at the request of counsel',
      'subject to attorney-client privilege',
      'subject to work product doctrine',
    ];
    const systemPrompt =
      'You are a legal AI assistant. Your task is to help flag potentially privileged content in legal documents. This is a preliminary review and not a substitute for legal review.';
    const userPrompt = `Scan the following document for any occurrences of these potentially privileged terms or phrases (case-insensitive):\n${privilegedTerms.map(t => `- ${t}`).join('\n')}\n\nDocument text:\n${document.extractedText.substring(0, 12000)}\n\nFor each term found, list the term, the sentence or context where it appears, and the location (e.g., page or section if available). If none are found, say so. Do not make up content. This is only a preliminary flagging tool.`;
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
  } catch (error) {
    console.error('Error in handleFlagPrivilegedTermsStream:', error);
    return { success: false, error: error as Error };
  }
};

export const handlePerplexityAgent = async (
  conversationId: string,
  params: { query: string },
  onChunk: (chunk: string) => void
): Promise<{ success: boolean; error: Error | null; sources?: any[] }> => {
  try {
    // a. Save User Request
    await addMessageSafely(conversationId, 'user', `/agent perplexity ${params.query}`);

    // c. Prepare Perplexity API Request
    const apiKey = process.env.PERPLEXITY_API_TOKEN;
    if (!apiKey) throw new Error('Perplexity API token not set');
    const url = 'https://api.perplexity.ai/chat/completions';
    const body = JSON.stringify({
      model: 'sonar-pro',
      messages: [
        { role: 'system', content: 'Be precise and concise.' },
        { role: 'user', content: params.query }
      ],
      stream: true
    });
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    };

    // d. Call Perplexity API & Handle Stream
    const response = await fetch(url, { method: 'POST', headers, body });
    if (!response.ok || !response.body) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }
    const reader = (response.body as unknown as ReadableStream<Uint8Array>).getReader();
    let fullText = '';
    let sources: any[] = [];
    let done = false;
    let buffer = '';
    while (!done) {
      const { value, done: streamDone } = await reader.read();
      if (value) {
        buffer += Buffer.from(value).toString('utf8');
        let lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const dataStr = line.replace('data:', '').trim();
            if (dataStr === '[DONE]') {
              done = true;
              break;
            }
            try {
              const data = JSON.parse(dataStr) as any;
              const contentDelta = data.choices?.[0]?.delta?.content;
              if (contentDelta) {
                onChunk(contentDelta);
                fullText += contentDelta;
              }
              // e. Extract sources if present
              if (data.choices && Array.isArray(data.choices) && data.choices[0]?.delta?.sources) {
                sources = data.choices[0].delta.sources;
              }
            } catch (err) {
              // Ignore JSON parse errors for non-data lines
            }
          }
        }
      }
      if (streamDone) break;
    }
    // g. Save Final Response
    await addMessageSafely(conversationId, 'assistant', fullText);
    return { success: true, error: null, sources };
  } catch (error) {
    return { success: false, error: error as Error };
  }
};
