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
  conversationId: string,
  message: string,
  onChunk: (chunk: string) => void,
  documentContext?: string,
  analysisContext?: string
): Promise<{ success: boolean; error: Error | null }> => {
  try {
    // Add user message to the database
    const { error: userMsgError } = await addMessage(
      conversationId,
      'user',
      message
    );

    if (userMsgError) {
      throw userMsgError;
    }

    // Get conversation history
    // Default to empty history if no conversationId (for new chats) or if there's an error
    let history: ChatMessage[] = [];
    
    if (conversationId && conversationId !== 'new') {
      const { data, error } = await getConversationMessages(conversationId);
      if (error) {
        console.warn('Could not fetch conversation history:', error);
        // Continue without history rather than throwing
      } else if (data) {
        history = data;
      }
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
        conversation_id: conversationId,
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
      .eq('id', conversationId);

    return { success: true, error: null };
  } catch (error) {
    console.error('Error sending message:', error);
    return { success: false, error: error as Error };
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
