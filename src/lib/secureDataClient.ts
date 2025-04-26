import { supabase } from './supabaseClient';

/**
 * SecureDataClient provides utilities for safely accessing data 
 * while avoiding RLS policy recursion issues
 */

// Helper function to get current user ID
const getCurrentUserId = async () => {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user?.id) {
    throw new Error('User not authenticated');
  }
  return user.user.id;
};

/**
 * Fetch cases safely while avoiding RLS recursion
 * This uses direct queries that don't trigger the problematic RLS policy chain
 */
export const fetchCasesSafely = async () => {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user?.id) {
      return { data: null, error: new Error('User not authenticated') };
    }

    // Two-step query to avoid infinite recursion in RLS policies
    // First get case IDs the user has access to
    const { data: caseIds, error: caseIdsError } = await supabase
      .from('case_collaborators')
      .select('case_id')
      .eq('user_id', user.user.id);

    if (caseIdsError) {
      console.error('Error fetching case IDs:', caseIdsError);
      return { data: null, error: caseIdsError };
    }

    if (!caseIds || caseIds.length === 0) {
      return { data: [], error: null };
    }

    // Then get the full case data for those IDs
    const { data: cases, error: casesError } = await supabase
      .from('cases')
      .select('*, documents:documents(count)')
      .in('id', caseIds.map(c => c.case_id))
      .order('updated_at', { ascending: false });

    if (casesError) {
      console.error('Error fetching case details:', casesError);
      return { data: null, error: casesError };
    }

    return { 
      data: cases.map(caseData => ({
        id: caseData.id,
        name: caseData.name,
        description: caseData.description,
        status: caseData.status,
        createdAt: caseData.created_at,
        updatedAt: caseData.updated_at,
        documentCount: caseData.documents?.count || 0,
      })), 
      error: null 
    };
  } catch (error) {
    console.error('Secure case fetch error:', error);
    return { data: null, error: error as Error };
  }
};

/**
 * Create a conversation safely to avoid RLS recursion issues
 */
export const createConversationSafely = async (
  title?: string,
  caseId?: string
) => {
  try {
    const userId = await getCurrentUserId();
    
    // Create conversation without using the RLS policies that cause recursion
    const conversationData = {
      id: crypto.randomUUID(),
      title: title || 'New Conversation',
      case_id: caseId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: userId,
    };

    const { data, error } = await supabase
      .from('conversations')
      .insert([conversationData])
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      return { data: null, error };
    }

    return {
      data: {
        id: data.id,
        title: data.title,
        caseId: data.case_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
      error: null,
    };
  } catch (error) {
    console.error('Secure conversation creation error:', error);
    return { data: null, error: error as Error };
  }
};

/**
 * Get a conversation safely to avoid RLS recursion issues
 */
export const getConversationSafely = async (conversationId: string) => {
  try {
    const userId = await getCurrentUserId();
    
    // Direct query approach to avoid RLS policy recursion
    // First check if user has access to this conversation
    const { data: access, error: accessError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (accessError) {
      console.error('Error checking conversation access:', accessError);
      return { data: null, error: accessError };
    }

    if (!access) {
      return { data: null, error: new Error('Conversation not found or no access') };
    }

    // Then get the full conversation data
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (error) {
      console.error('Error getting conversation:', error);
      return { data: null, error };
    }

    return {
      data: {
        id: data.id,
        title: data.title,
        caseId: data.case_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
      error: null,
    };
  } catch (error) {
    console.error('Secure conversation fetch error:', error);
    return { data: null, error: error as Error };
  }
};

/**
 * Get conversation messages safely to avoid RLS recursion issues
 */
export const getConversationMessagesSafely = async (conversationId: string) => {
  try {
    // First verify the user has access to this conversation
    const { data: conversation, error: convError } = await getConversationSafely(conversationId);
    
    if (convError || !conversation) {
      return { data: null, error: convError || new Error('Conversation not found') };
    }

    // Then get messages
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error getting messages:', error);
      return { data: null, error };
    }

    return {
      data: data.map(message => ({
        id: message.id,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
      })),
      error: null,
    };
  } catch (error) {
    console.error('Secure message fetch error:', error);
    return { data: null, error: error as Error };
  }
};

/**
 * Add a message safely to avoid RLS recursion issues
 */
export const addMessageSafely = async (
  conversationId: string,
  role: 'system' | 'user' | 'assistant',
  content: string
) => {
  try {
    // First verify user has access to the conversation
    const { data: conversation, error: convError } = await getConversationSafely(conversationId);
    
    if (convError || !conversation) {
      return { data: null, error: convError || new Error('Conversation not found') };
    }

    const userId = await getCurrentUserId();

    // Now add the message without depending on RLS policies
    const messageData = {
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      role,
      content,
      timestamp: new Date().toISOString(),
      user_id: userId
    };

    const { data, error } = await supabase
      .from('messages')
      .insert([messageData])
      .select()
      .single();

    if (error) {
      console.error('Error adding message:', error);
      return { data: null, error };
    }

    // Update the conversation's updated_at timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return {
      data: {
        id: data.id,
        role: data.role,
        content: data.content,
        timestamp: data.timestamp,
      },
      error: null,
    };
  } catch (error) {
    console.error('Secure message add error:', error);
    return { data: null, error: error as Error };
  }
};
