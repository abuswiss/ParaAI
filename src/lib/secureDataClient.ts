import { supabase, isAuthenticated } from './supabaseClient';

/**
 * SecureDataClient provides utilities for safely accessing data 
 * while avoiding RLS policy recursion issues
 */

/**
 * Helper function to get current user ID with authentication verification
 * This will attempt to refresh the session if needed
 * @returns User ID string
 * @throws Error if user is not authenticated
 */
const getCurrentUserId = async () => {
  // First try to get the user directly
  const { data: user } = await supabase.auth.getUser();
  
  // If we have a user, return the ID
  if (user?.user?.id) {
    return user.user.id;
  }
  
  // Otherwise, try to get a new session
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session?.user?.id) {
    return sessionData.session.user.id;
  }
  
  // If we still don't have a user, check authentication directly
  const authenticated = await isAuthenticated();
  
  if (!authenticated) {
    throw new Error('Not authenticated. Please sign in again.');
  }
  
  // If authenticated but still no user ID, there's something wrong with the auth state
  throw new Error('User authenticated but unable to retrieve user ID');
  
  throw new Error('User not authenticated despite successful connection');
};

/**
 * Fetch cases safely while avoiding RLS recursion
 * This uses direct queries that don't trigger the problematic RLS policy chain
 */
// Helper function to format case data
function formatCases(cases: any[]) {
  return cases.map(caseData => ({
    id: caseData.id,
    name: caseData.name,
    description: caseData.description,
    status: caseData.status || 'active',
    createdAt: caseData.created_at,
    updatedAt: caseData.updated_at,
    documentCount: 0, // We'll set this to 0 for now since document counts will be handled elsewhere
  }));
}

export const fetchCasesSafely = async () => {
  try {
    console.log('fetchCasesSafely called, checking auth status');
    
    // First check authentication
    const authResult = await supabase.auth.getUser();
    console.log('Auth check result:', JSON.stringify(authResult));
    
    const user = authResult.data.user;
    if (!user?.id) {
      console.error('User not authenticated');
      return { data: [], error: new Error('User not authenticated') };
    }

    console.log('Fetching cases for user:', user.id);
    
    // Check if we can query any table first
    try {
      console.log('Testing basic query to _health check table');
      const healthCheck = await supabase.from('_health_check').select('*').limit(1);
      console.log('Health check result:', JSON.stringify(healthCheck));
    } catch (e) {
      console.error('Health check failed:', e);
    }
    
    // Try the absolute most basic query
    console.log('Executing basic query to cases table with no filters');
    try {
      const query = supabase.from('cases').select('*');
      console.log('Query object created, executing...');
      
      const { data, error } = await query;
      console.log('Query executed, result:', JSON.stringify({ data: data?.length || 0, error }));

      if (error) {
        console.error('Error executing basic cases query:', error);
        return { data: [], error: null };
      }
      
      if (!data || data.length === 0) {
        console.log('No cases found in the database');
        return { data: [], error: null };
      }
      
      // Filter for user's cases client-side
      console.log('Filtering cases for user:', user.id);
      const userCases = data.filter(c => String(c.owner_id) === String(user.id));
      console.log('User cases found:', userCases.length);
      
      return {
        data: formatCases(userCases),
        error: null
      };
    } catch (error) {
      console.error('Exception during case fetch:', error);
      return { data: [], error: null };
    }
  } catch (error) {
    console.error('Error in fetchCasesSafely:', error);
    return { data: [], error: error as Error };
  }
};

/**
 * Create a conversation securely while avoiding RLS recursion issues
 */
export const createConversationSafely = async (
  title?: string,
  caseId?: string
) => {
  try {
    // Get the current user ID - this will attempt to refresh auth if needed
    const userId = await getCurrentUserId();
    
    // Generate a unique conversation ID
    const conversationId = crypto.randomUUID();
    
    // Create conversation with proper data validation
    const conversationData = {
      id: conversationId,
      title: title?.trim() || 'New Conversation',
      case_id: caseId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      owner_id: userId, // Using owner_id as per the database schema
    };

    // Store in Supabase
    const { data, error } = await supabase
      .from('conversations')
      .insert([conversationData])
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      
      // Check if this is a server error (500)
      if (error.code === '500' || (error as any).status === 500) {
        // For 500 Internal Server errors, this could be a database schema issue
        // or a server-side error, not an authentication problem
        
        // Let's log the full error details to help debugging
        console.error('Database server error details:', {
          code: error.code,
          status: (error as any).status,
          message: error.message,
          details: error.details,
          hint: error.hint,
          fullError: JSON.stringify(error)
        });
        
        return { 
          data: null, 
          error: new Error(`Database server error: ${error.message || 'Internal Server Error'} - This may be a schema issue with the conversations table`) 
        };
      }
      
      // Check if this is an authentication error (401, 403)
      if (error.code === '401' || error.code === '403') {
        const authenticated = await isAuthenticated();
        if (!authenticated) {
          return { 
            data: null, 
            error: new Error('Authentication error. Please sign in again.') 
          };
        }
      }
      
      // For any other errors, return a more detailed error message
      return { 
        data: null, 
        error: new Error(`Database error: ${error.message || 'Unknown error'} (Code: ${error.code || 'unknown'})`) 
      };
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
export const getConversationSafely = async (conversationId: string | null) => {
  try {
    // If no conversationId is provided, return early
    if (!conversationId) {
      return { 
        data: null, 
        error: new Error('No conversation ID provided. Create a conversation first.') 
      };
    }
    
    const userId = await getCurrentUserId();
    
    // Direct query approach to avoid RLS policy recursion
    // First check if user has access to this conversation
    const { data: access, error: accessError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('owner_id', userId) // Using owner_id as per the database schema
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
  conversationId: string | null,
  role: 'system' | 'user' | 'assistant',
  content: string
) => {
  try {
    // If no conversationId is provided, return early with helpful error
    if (!conversationId) {
      return { 
        data: null, 
        error: new Error('Cannot add message: No conversation ID provided. Create a conversation first.') 
      };
    }
  
    // First verify user has access to the conversation
    const { data: conversation, error: convError } = await getConversationSafely(conversationId);
    
    if (convError || !conversation) {
      return { data: null, error: convError || new Error('Conversation not found') };
    }

    const userId = await getCurrentUserId();

    // Now add the message without depending on RLS policies
    // Create a message object using only the owner_id field
    // The user_id field caused a 400 error as it doesn't exist in the schema cache
    const messageData = {
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      role,
      content,
      created_at: new Date().toISOString(),
      owner_id: userId       // For owner-based RLS policies
    };

    // Include detailed debug info in development mode
    if (import.meta.env.DEV) {
      console.log('Inserting message with data:', { ...messageData, content: messageData.content.substring(0, 50) + '...' });
    }

    // Insert with count option for debugging
    const { data, error } = await supabase
      .from('messages')
      .insert([messageData], { 
        count: 'exact'  // Get count of inserted rows
      })
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
