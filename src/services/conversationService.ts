import { supabase } from '../lib/supabaseClient';
import { 
  createConversationSafely,
  getConversationSafely
} from '../lib/secureDataClient';

console.log('Conversation service initializing...');

// --- Interfaces (Might move to src/types later) ---

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
 * Interface for Conversation List Item (used in Sidebar)
 */
export interface ConversationListItem {
  id: string;
  title: string; 
  updatedAt: string;
  caseId?: string | null; 
}

// Placeholder for conversation-related functions 

// --- Moved functions from chatService.ts --- 

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
 * Fetches a list of conversations for the current user, optionally filtered by case ID.
 * Returns lightweight data suitable for a sidebar list.
 */
export const getConversationsList = async (
  caseId?: string | null
): Promise<{ data: ConversationListItem[] | null; error: Error | null }> => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw authError || new Error('User not authenticated');
    }

    let query = supabase
      .from('conversations')
      .select('id, title, updated_at, case_id')
      .eq('owner_id', user.id)
      // TODO: Add RLS policy to ensure user can only see their own conversations
      .order('updated_at', { ascending: false });

    // Apply case filter if provided
    if (caseId) {
      query = query.eq('case_id', caseId);
    } else {
      // If no caseId, maybe filter out conversations that *do* have a caseId?
      // Or show all? For now, show all associated with the user if no caseId filter.
      // query = query.is('case_id', null); // Example: Only show non-case specific chats
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching conversation list:', error);
      throw error;
    }

    // Transform data to ConversationListItem interface
    const conversationList: ConversationListItem[] = (data || []).map(conv => ({
      id: conv.id,
      // Use existing title, or generate one if needed (e.g., from first message - requires another query)
      title: conv.title || `Chat from ${new Date(conv.updated_at).toLocaleDateString()}`,
      updatedAt: conv.updated_at,
      caseId: conv.case_id,
    }));

    return { data: conversationList, error: null };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error fetching conversation list';
    console.error('Error in getConversationsList:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
}; 