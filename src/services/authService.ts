import { supabase } from '../lib/supabaseClient';
import { UserCredentials, SignUpData } from '../types/auth';

/**
 * Sign in with email and password
 */
export const signIn = async ({ email, password }: UserCredentials) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return { data, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error during sign in';
    console.error('Error signing in:', message);
    return { data: null, error };
  }
};

/**
 * Sign up with email and password
 */
export const signUp = async ({ email, password }: SignUpData) => {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) throw authError;

    if (authData.user) {
      const trialDurationDays = 10;
      const now = new Date();
      const trialEndDate = new Date(now);
      trialEndDate.setDate(now.getDate() + trialDurationDays);

      // Ensure you have a 'profiles' table with 'user_id' (matching auth.users.id),
      // 'email', 'trial_started_at', 'trial_ends_at', 'trial_ai_calls_used', and 'subscription_status'.
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: authData.user.id, // Assuming 'id' in profiles table is the foreign key to auth.users.id
            email: authData.user.email,
            trial_started_at: now.toISOString(),
            trial_ends_at: trialEndDate.toISOString(),
            trial_ai_calls_used: 0,
            subscription_status: 'trialing',
            // Add any other default profile fields here, e.g., full_name: '', avatar_url: ''
          },
        ]);

      if (profileError) {
        // If profile creation fails, we might want to clean up the auth user
        // or log this as a critical issue. For now, just logging and re-throwing.
        console.error('Error creating profile with trial info:', profileError);
        // Potentially delete the auth user if profile creation is critical for app function
        // await supabase.auth.admin.deleteUser(authData.user.id) // Requires admin privileges
        throw profileError;
      }
    } else {
      // This case should ideally not be reached if signUp was successful without error
      console.warn('User object was null after successful signUp without error. Profile not created.');
    }

    return { data: authData, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error during sign up';
    console.error('Error signing up or creating profile:', message);
    return { data: null, error };
  }
};

/**
 * Sign out the current user
 */
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error during sign out';
    console.error('Error signing out:', message);
    return { error };
  }
};

/**
 * Get the current session
 */
export const getSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return { data, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error getting session';
    console.error('Error getting session:', message);
    return { data: null, error };
  }
};

/**
 * Get the current user
 */
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return { user, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error getting user';
    console.error('Error getting user:', message);
    return { user: null, error };
  }
};
