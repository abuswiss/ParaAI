import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default development fallbacks - ONLY FOR DEVELOPMENT
// These will allow the app to function during development without requiring a full Supabase setup
const DEV_FALLBACK_URL = 'https://dev-placeholder-project.supabase.co';
const DEV_FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTl9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

// Get the values from environment variables with runtime validation
// Using explicit string casting to ensure TypeScript compatibility
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Console log environment variables for debugging in development
if (import.meta.env.DEV) {
  // Don't log the full key for security, just log a prefix to confirm it exists
  console.log('Supabase URL set:', !!supabaseUrl);
  console.log('Supabase Key set:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 5)}...` : 'MISSING');
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Using development fallbacks for Supabase. Authentication and database operations will be mocked.');
  }
}

// Check if we're in development mode
const isDevelopment = import.meta.env.DEV;

// Create the Supabase client with proper error handling
const createSupabaseClient = (): SupabaseClient => {
  // Validate environment variables or use development fallbacks
  let finalUrl = supabaseUrl;
  let finalKey = supabaseAnonKey;
  
  // In development, use fallbacks when environment variables are missing
  if (isDevelopment && (!supabaseUrl || supabaseUrl === 'undefined' || supabaseUrl === '')) {
    console.warn('VITE_SUPABASE_URL is missing or invalid - using development fallback');
    finalUrl = DEV_FALLBACK_URL;
  }
  
  if (isDevelopment && (!supabaseAnonKey || supabaseAnonKey === 'undefined' || supabaseAnonKey === '')) {
    console.warn('VITE_SUPABASE_ANON_KEY is missing or invalid - using development fallback');
    finalKey = DEV_FALLBACK_KEY;
  }
  
  // In production, we must have real credentials
  if (!isDevelopment) {
    if (!supabaseUrl || supabaseUrl === 'undefined' || supabaseUrl === '') {
      throw new Error('Supabase URL is required in production. Please check your environment variables.');
    }
    
    if (!supabaseAnonKey || supabaseAnonKey === 'undefined' || supabaseAnonKey === '') {
      throw new Error('Supabase Anonymous Key is required in production. Please check your environment variables.');
    }
  }

  const retryCount = isDevelopment ? 3 : 2; // More retries in development
  const retryDelay = 1000; // 1 second delay between retries

  // Custom fetch wrapper with retry logic
  const fetchWithRetry = async (input: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
    let lastError: Error;
    
    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        // Add retry attempt header for debugging
        const requestOptions = {
          ...options,
          headers: {
            ...(options?.headers || {}),
            'X-Retry-Attempt': `${attempt + 1}`
          }
        };

        // Attempt the fetch
        const response = await fetch(input, requestOptions);
        
        // If we're being rate limited, wait and retry
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : retryDelay;
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        return response;
      } catch (err) {
        console.warn(`Supabase fetch attempt ${attempt + 1}/${retryCount} failed:`, err);
        lastError = err as Error;
        
        // Wait before retrying
        if (attempt < retryCount - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    // All attempts failed
    throw lastError!;
  };

  // Log successful validation in dev mode
  if (isDevelopment) {
    console.log('Supabase client initialization with valid credentials');
  }

  // Create the client with enhanced config and explicit string parameters
  // This ensures the URL and key are properly passed as strings
  return createClient(finalUrl.trim(), finalKey.trim(), {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'paralegal-app-auth', // Use a specific storage key
      flowType: 'pkce' // Use PKCE flow for enhanced security
    },
    global: {
      fetch: fetchWithRetry
    },
    // Add reasonable timeouts
    realtime: {
      timeout: 30000 // 30 seconds
    }
  });
};

// Create and export the Supabase client
export const supabase = createSupabaseClient();

/**
 * Utility function to check if Supabase is properly connected and authenticated
 * Returns detailed information about the connection status
 */
export const checkSupabaseConnection = async (): Promise<{
  connected: boolean;
  authenticated: boolean;
  error?: string;
}> => {
  try {
    // First check if we can access the API at all
    const { error: connectionError } = await supabase.from('_dummy_query').select('*').limit(1);
    
    // If we get PGRST116 (relation does not exist), it means the connection is working
    // but the table doesn't exist - which is expected and good
    const isConnected = !connectionError || connectionError.code === 'PGRST116';
    
    // Next check if we have a valid session
    const { data: sessionData } = await supabase.auth.getSession();
    const isAuthenticated = !!sessionData.session;
    
    // If connected but not authenticated in production, that's a problem
    if (isConnected && !isAuthenticated && !isDevelopment) {
      console.warn('Connected to Supabase but not authenticated');
    }
    
    return {
      connected: isConnected,
      authenticated: isAuthenticated,
      error: connectionError && connectionError.code !== 'PGRST116' ? connectionError.message : undefined
    };
  } catch (error: any) {
    console.error('Failed to check Supabase connection:', error);
    return {
      connected: false,
      authenticated: false,
      error: error?.message || 'Unknown connection error'
    };
  }
};

/**
 * Get Supabase connection status as a user-friendly string
 */
export const getConnectionStatusText = async (): Promise<string> => {
  const status = await checkSupabaseConnection();
  
  if (!status.connected) {
    return 'Disconnected from database';
  }
  
  if (!status.authenticated) {
    return 'Connected, but not authenticated';
  }
  
  return 'Connected and authenticated';
};

/**
 * Attempt to refresh the session token
 * Returns true if successful or if already authenticated
 */
export const refreshSession = async (): Promise<boolean> => {
  try {
    // Check current session first
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return true; // Already authenticated
    
    // Try to refresh the session
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('Failed to refresh session:', error);
      return false;
    }
    
    // Verify we now have a session
    const { data: { session: refreshedSession } } = await supabase.auth.getSession();
    return !!refreshedSession;
  } catch (error) {
    console.error('Error refreshing session:', error);
    return false;
  }
};
