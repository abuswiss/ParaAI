import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get environment variables for Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const isDevelopment = import.meta.env.DEV;

/**
 * Validates Supabase configuration and logs helpful messages in development mode
 */
function validateConfig(): { isValid: boolean, url: string, key: string } {
  const url = supabaseUrl?.trim() || '';
  const key = supabaseAnonKey?.trim() || '';
  const isValid = !!url && !!key && url !== 'undefined' && key !== 'undefined';
  
  if (isDevelopment) {
    if (isValid) {
      console.log('✅ Supabase configuration is valid');
      // Only show part of the URL for security
      const urlDisplay = url.includes('://') ? 
        url.split('://')[0] + '://' + url.split('://')[1].substring(0, 10) + '...' : 
        url.substring(0, 15) + '...';
      console.log(`URL: ${urlDisplay}`);
      
      // Only check if key has JWT format (starts with eyJ)
      const keyValid = key.startsWith('eyJ');
      console.log(`API Key format is ${keyValid ? 'valid' : 'INVALID'} ${keyValid ? '✓' : '✗'}`);
    } else {
      console.error('❌ Supabase configuration is INVALID');
      console.error(`URL present: ${!!url} | Key present: ${!!key}`);
      console.error('Authentication will not work. Check your .env file values for:');
      console.error('- VITE_SUPABASE_URL');
      console.error('- VITE_SUPABASE_ANON_KEY');
    }
  }
  
  return { isValid, url, key };
}

// Run validation
const { isValid, url: validUrl, key: validKey } = validateConfig();

// In production, we require valid configuration
if (!isValid && !isDevelopment) {
  throw new Error('Missing or invalid Supabase configuration. Check environment variables.');
}

/**
 * Creates a configured Supabase client with proper error handling
 */
function createSupabaseClient(): SupabaseClient {
  // Enhanced fetch for better error messaging and debugging
  const enhancedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const inputUrl = typeof input === 'string' ? input : input.toString();
    
    // Add authentication headers if they're missing
    const headers = new Headers(init?.headers || {});
    
    if (!headers.has('apikey')) {
      headers.set('apikey', validKey);
    }
    
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${validKey}`);
    }
    
    const options = {
      ...init,
      headers
    };
    
    try {
      if (isDevelopment) {
        // Log request details (without sensitive parts)
        const urlForLogging = inputUrl.split('?')[0]; // Remove query params for security
        console.log(`📤 Supabase request: ${urlForLogging}`);
      }
      
      // Make the request
      const response = await fetch(input, options);
      
      // Log helpful error information
      if (response.status >= 400 && isDevelopment) {
        console.warn(`⚠️ Supabase response status: ${response.status}`);
        
        if (response.status === 401) {
          console.warn('Authentication error - verify API key and user authentication');
          // Try to get auth status from localStorage for debugging
          try {
            const session = localStorage.getItem('paralegal-app-auth');
            console.warn('Auth session exists:', !!session);
          } catch (e) {
            console.warn('Could not check auth session');
          }
        }
      }
      
      return response;
    } catch (error) {
      console.error('❌ Supabase request failed:', error);
      throw error;
    }
  };
  
  if (isDevelopment) {
    console.log('🔄 Initializing Supabase client...');
  }
  
  // Create and return Supabase client with our configuration
  return createClient(validUrl, validKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'paralegal-app-auth',
      debug: isDevelopment
    },
    global: {
      fetch: enhancedFetch
    }
  });
}

// Export the Supabase client
export const supabase = createSupabaseClient();

/**
 * Utility function to check if the user is currently authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  } catch (error) {
    console.error('Error checking authentication status:', error);
    return false;
  }
}

/**
 * Get a formatted string with the current connection status
 */
export async function getConnectionStatus(): Promise<string> {
  try {
    // Simple connection test
    const start = Date.now();
    const { error } = await supabase.from('_dummy_query').select('*').limit(1);
    const time = Date.now() - start;
    
    // If we get a 404 error about relation not existing, that's actually good
    // It means we connected to the API successfully
    if (error) {
      // PostgresError code PGRST116 means "relation does not exist"
      // Code 42P01 is the PostgreSQL error code for "undefined_table"
      // Both indicate the API connection worked but the table doesn't exist (expected)
      const isExpectedError = 
        error.code === 'PGRST116' || 
        error.code === '42P01' || 
        error.message.includes('does not exist');
      
      if (isExpectedError) {
        const authStatus = await isAuthenticated();
        return `Connected to Supabase (${time}ms) | Auth: ${authStatus ? 'Yes ✓' : 'No ✗'}`;
      }
      
      return `Connection error: ${error.message} (${error.code || 'unknown'})`;
    }
    
    return `Connected to Supabase (${time}ms)`;
  } catch (error) {
    return `Error checking connection: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

// Export additional utility functions for use in the application
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
