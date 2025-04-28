import { supabase, isAuthenticated } from './supabaseClient';
import { Case } from '@/types/case'; // Import the Case type

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

// Define a type for the raw data expected from the cases table
// Ensure all fields required by the Case interface are included
interface RawCaseData {
  id: string;
  name: string; // Changed from optional, assuming name is required
  description: string | null;
  status: 'active' | 'archived' | 'closed'; // Use specific types
  created_at: string;
  updated_at: string;
  owner_id: string;
  // Added back columns confirmed to exist in DB
  client_name: string | null;
  opposing_party: string | null;
  case_number: string | null;
  court: string | null;
}

/**
 * Fetch cases safely while avoiding RLS recursion
 * This uses direct queries that don't trigger the problematic RLS policy chain
 */
// Helper function to format case data
// Return full Case[] and map all fields
function formatCases(cases: RawCaseData[]): Case[] { 
  return cases.map(caseData => ({
    id: caseData.id,
    name: caseData.name, // Use name directly
    description: caseData.description,
    status: caseData.status, // Status should be directly available
    createdAt: caseData.created_at,
    updatedAt: caseData.updated_at,
    // Added back columns confirmed to exist in DB
    client_name: caseData.client_name,
    opposing_party: caseData.opposing_party,
    case_number: caseData.case_number, 
    court: caseData.court,
    documentCount: 0, // Initialize count, actual count needs separate query if desired
  }));
}

export const fetchCasesSafely = async (): Promise<{ data: Case[], error: Error | null }> => {
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
    /* // Commenting out health check as the table doesn't exist
    try {
      console.log('Testing basic query to _health check table');
      const healthCheck = await supabase.from('_health_check').select('*').limit(1);
      console.log('Health check result:', JSON.stringify(healthCheck));
    } catch (e) {
      console.error('Health check failed:', e);
    }
    */
    
    // Query specifically for the fields needed by RawCaseData/Case
    console.log('Executing query to cases table for user cases');
    try {
      const { data, error } = await supabase
        .from('cases')
        // Corrected select syntax: provide columns as a comma-separated string
        // Added back columns confirmed to exist in DB
        .select<string, RawCaseData>('id, name, description, status, created_at, updated_at, owner_id, client_name, opposing_party, case_number, court')
        .eq('owner_id', user.id); // Filter by owner_id directly in the query

      console.log('Query executed, result:', JSON.stringify({ data: data?.length || 0, error }));

      if (error) {
        console.error('Error executing cases query:', error);
        // Decide if we should return error or empty data
        // Returning empty data might be better UX than showing an error for RLS issues
        return { data: [], error: null }; 
      }
      
      if (!data || data.length === 0) {
        console.log('No cases found for user in the database');
        return { data: [], error: null };
      }
      
      // No longer need client-side filtering as owner_id is in the query
      // console.log('Filtering cases for user:', user.id);
      // const userCases = data.filter(c => String(c.owner_id) === String(user.id));
      // console.log('User cases found:', userCases.length);
      
      return {
        data: formatCases(data), // Pass the directly fetched data
        error: null
      };
    } catch (error) {
      console.error('Exception during case fetch:', error);
      return { data: [], error: error instanceof Error ? error : new Error('Unknown error fetching cases') };
    }
  } catch (error) {
    console.error('Error in fetchCasesSafely:', error);
    return { data: [], error: error as Error };
  }
};

// Define type for raw conversation data from DB
interface RawConversationData {
  id: string;
  title: string;
  case_id: string | null;
  created_at: string;
  updated_at: string;
  // owner_id is known from insert/query
}

// Define type for the returned conversation data
interface Conversation {
  id: string;
  title: string;
  caseId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create a conversation securely while avoiding RLS recursion issues
 */
export const createConversationSafely = async (
  title?: string,
  caseId?: string
): Promise<{ data: Conversation | null; error: Error | null }> => {
  try {
    // Get the current user ID - this will attempt to refresh auth if needed
    const userId = await getCurrentUserId();
    
    // Let the database handle ID generation and timestamps
    // const conversationId = crypto.randomUUID(); // No longer needed
    
    // Create conversation data, omitting fields with DB defaults
    const conversationData = {
      // id: conversationId, // Let DB handle default
      title: title?.trim() || 'New Conversation',
      case_id: caseId || null,
      // created_at: new Date().toISOString(), // Let DB handle default
      // updated_at: new Date().toISOString(), // Let DB handle default
      owner_id: userId, // Still need to provide the owner
    };

    // Use the RawConversationData type for the select
    const { data, error } = await supabase
      .from('conversations')
      .insert([conversationData])
      .select<'*', RawConversationData>('*')
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      
      // Check specific error codes instead of (error as any).status
      if (error.code === '500' || error.code === 'PGRST116') { // PGRST116 is often Internal Server Error
        console.error('Database server error details:', {
          code: error.code,
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
      
      // Check for Auth errors (often PGRST 301/302 if RLS fails, though 401/403 might appear too)
      if (error.code === '401' || error.code === '403' || error.code === 'PGRST301' || error.code === 'PGRST302') {
        const authenticated = await isAuthenticated();
        if (!authenticated) {
          return { 
            data: null, 
            error: new Error('Authentication error. Please sign in again.') 
          };
        }
      }
      
      // Foreign key violation check (example code might differ)
      if (error.code === '23503') { // PostgreSQL FK violation code
        if (error.message.includes('conversations_owner_id_fkey')) {
          return { data: null, error: new Error('Failed to create conversation: User profile might be missing. Please contact support or try signing out and back in.') };
        }
      }
      
      // Default error
      return { 
        data: null, 
        error: new Error(`Database error: ${error.message || 'Unknown error'} (Code: ${error.code || 'unknown'})`) 
      };
    }

    // Map RawConversationData to Conversation type
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
    // Make sure the error message indicates a potential profile issue if it's an FK violation
    if (error instanceof Error && error.message.includes('violates foreign key constraint "conversations_owner_id_fkey"')) {
        return { data: null, error: new Error('Failed to create conversation: User profile might be missing. Please contact support or try signing out and back in.') };
    }
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
