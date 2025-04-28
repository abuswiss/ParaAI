import { useState, useEffect, useCallback } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import * as authService from '@/services/authService';

interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: typeof authService.signIn;
  signUp: typeof authService.signUp;
  signOut: () => Promise<{ error: AuthError | unknown | null }>;
}

export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const checkUserSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Try getCurrentUser first
      const { user: currentUserData, error: userError } = await authService.getCurrentUser();

      if (userError) {
        // If getUser fails, log it but proceed to check session
        console.warn('Error fetching current user, trying session:', userError);
      }

      if (currentUserData) {
        setUser(currentUserData);
      } else {
        // If getUser returns no user (or errored), try getSession
        const { data: sessionData, error: sessionError } = await authService.getSession();

        if (sessionError) {
          // Handle session fetch error
          throw sessionError; // Throw to be caught below
        }
        // Correctly access nested session and user
        setUser(sessionData?.session?.user ?? null);
      }

    } catch (err: unknown) { // Catch specific AuthError or unknown
      console.error("Error checking user session:", err);
      const message = err instanceof AuthError ? err.message : 'Failed to check authentication status.';
      setError(message);
      setUser(null); // Ensure user is null on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkUserSession();

    // Optional: Set up a listener for auth state changes if Supabase provides one
    // This would keep the user state synced without needing manual refreshes
    // const { data: authListener } = authService.supabase.auth.onAuthStateChange(
    //   (_event, session) => {
    //     setUser(session?.user ?? null);
    //     setLoading(false); // Update loading state when listener responds
    //   }
    // );
    // return () => {
    //   authListener?.subscription.unsubscribe();
    // };

  }, [checkUserSession]);

  // Wrap signOut to clear local state and return the service result
  const handleSignOut = useCallback(async (): Promise<{ error: AuthError | unknown | null }> => {
    setLoading(true);
    setError(null); // Clear previous errors
    let result: { error: AuthError | unknown | null } = { error: null };
    try {
      result = await authService.signOut();
      if (result.error) throw result.error; // Throw if service returns error
      setUser(null);
      // Optional: Redirect user after sign out
      // window.location.href = '/login';
    } catch (err: unknown) {
      console.error("Error signing out:", err);
      const message = err instanceof AuthError ? err.message : 'Failed to sign out.';
      setError(message);
      // Ensure the error object from the catch block is returned if authService.signOut() didn't provide one
      if (!result.error) {
          result = { error: err };
      }
    } finally {
      setLoading(false);
    }
    return result; // Return the result from authService.signOut or the caught error
  }, []);

  return {
    user,
    loading,
    error,
    signIn: authService.signIn, // Directly expose service functions
    signUp: authService.signUp,
    signOut: handleSignOut, // Use the wrapped signOut
  };
}; 