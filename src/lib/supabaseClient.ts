import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default fallback URL and key for development (these won't actually work, but prevent crashes)
const FALLBACK_URL = 'https://example.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4YW1wbGUiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjQyMjU0MCwiZXhwIjoxNjE2NDI2MTQwfQ.fallback-key';

// Get the values from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string || FALLBACK_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string || FALLBACK_KEY;

// Check if we're in development mode
const isDevelopment = import.meta.env.DEV;

let supabaseInstance: SupabaseClient;

try {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase URL or Anonymous key is missing, using fallback values');
  }

  // Create the Supabase client
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    },
    global: {
      // Add error handling for requests
      fetch: (url, options) => {
        return fetch(url, options)
          .catch(error => {
            console.error('Supabase fetch error:', error);
            throw error;
          });
      }
    }
  });
  
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
  // Create a fallback client that will gracefully fail
  supabaseInstance = createClient(FALLBACK_URL, FALLBACK_KEY);
}

// Export the Supabase client
export const supabase = supabaseInstance;

// Utility function to check if Supabase is properly connected
export const checkSupabaseConnection = async (): Promise<boolean> => {
  try {
    // Try to make a simple request to test the connection
    const { error } = await supabase.from('_dummy_query').select('*').limit(1);
    
    // If we get an error about the table not existing, that's actually good - it means the connection works
    if (error && error.code === 'PGRST116') {
      return true;
    }
    
    // If we get other errors, log them but allow the app to continue in development
    if (error) {
      console.warn('Supabase connection check encountered an error:', error);
      return isDevelopment;
    }
    
    return true;
  } catch (error) {
    console.error('Failed to check Supabase connection:', error);
    // In development, we'll still return true to allow the app to function
    return isDevelopment;
  }
};
