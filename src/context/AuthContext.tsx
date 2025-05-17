import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Session, User, PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient'; // Import your configured Supabase client

// Define UserProfile type if it's not already available globally
// This should ideally match your 'profiles' table structure
export interface UserProfile {
  id: string; // Typically mirrors auth.users.id
  email?: string;
  full_name?: string;
  avatar_url?: string;
  // Subscription and trial fields
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  trial_ai_calls_used?: number | null;
  subscription_status?: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  current_period_ends_at?: string | null;
  // Add other profile fields as needed
}

// Define the expected shape of the Supabase response for a single profile
interface SupabaseProfileResponse {
    data: UserProfile | null;
    error: PostgrestError | null;
    status: number;
    statusText: string;
    count: number | null;
}

// Ensure AuthContextType is exported
export interface AuthContextType {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  fetchUserProfile: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// Create the context with a default value
// Ensure AuthContext is exported
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Utility function for fetch with timeout
const fetchWithTimeout = <T,>(
  promise: Promise<T>,
  timeoutMs: number,
  userIdForLog: string,
  timeoutMessagePrefix: string = 'Operation'
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  // Log entry into fetchWithTimeout consistently
  console.log(`[fetchWithTimeout] User ${userIdForLog}: Setting up ${timeoutMessagePrefix} with timeout for ${timeoutMs}ms.`);

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      console.log(`[fetchWithTimeout] User ${userIdForLog}: TIMEOUT! ${timeoutMessagePrefix} timed out after ${timeoutMs}ms.`);
      reject(new Error(`${timeoutMessagePrefix} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise])
    .finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        // Log clearing of timeout consistently
        console.log(`[fetchWithTimeout] User ${userIdForLog}: Timeout for ${timeoutMessagePrefix} cleared.`);
      }
    });
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = useCallback(async (userId: string) => {
    console.log(`AuthContext: fetchUserProfile called for user ID: ${userId}.`);
    if (!userId) {
      console.error("AuthContext: fetchUserProfile called with null or undefined userId. Clearing profile.");
      setUserProfile(null);
      return;
    }

    if (!supabase || !supabase.from) {
        console.error("AuthContext: Supabase client or 'from' method not available in fetchUserProfile. Clearing profile.");
        setUserProfile(null);
        return;
    }

    const selectString = '*, trial_started_at, trial_ai_calls_used, subscription_status, trial_ends_at, stripe_customer_id, stripe_subscription_id, stripe_price_id, current_period_ends_at';

    // Step 1: .from()
    console.log(`AuthContext: User ${userId} - Step 1: About to call supabase.from('profiles').`);
    const profilesTable = supabase.from('profiles');
    console.log(`AuthContext: User ${userId} - Step 2: supabase.from('profiles') returned. Type: ${typeof profilesTable}, Constructor:`, profilesTable?.constructor?.name);
    if (!profilesTable || typeof profilesTable.select !== 'function') {
        console.error(`AuthContext: User ${userId} - Error after Step 2: profilesTable is invalid or has no 'select' method. Value:`, profilesTable);
        setUserProfile(null); return;
    }

    // Step 2: .select()
    console.log(`AuthContext: User ${userId} - Step 3: About to call .select('${selectString}').`);
    const selectQuery = profilesTable.select(selectString);
    console.log(`AuthContext: User ${userId} - Step 4: .select(...) returned. Type: ${typeof selectQuery}, Constructor:`, selectQuery?.constructor?.name);
    if (!selectQuery || typeof selectQuery.eq !== 'function') {
        console.error(`AuthContext: User ${userId} - Error after Step 4: selectQuery is invalid or has no 'eq' method. Value:`, selectQuery);
        setUserProfile(null); return;
    }

    // Step 3: .eq()
    console.log(`AuthContext: User ${userId} - Step 5: About to call .eq('id', '${userId}').`);
    const eqQuery = selectQuery.eq('id', userId);
    console.log(`AuthContext: User ${userId} - Step 6: .eq('id', userId) returned. Type: ${typeof eqQuery}, Constructor:`, eqQuery?.constructor?.name);
    if (!eqQuery || typeof eqQuery.single !== 'function') {
        console.error(`AuthContext: User ${userId} - Error after Step 6: eqQuery is invalid or has no 'single' method. Value:`, eqQuery);
        setUserProfile(null); return;
    }

    // Step 4: .single()
    console.log(`AuthContext: User ${userId} - Step 7: About to call .single().`);
    const singleQueryPromiseBuilder = eqQuery.single<UserProfile>(); 
    console.log(`AuthContext: User ${userId} - Step 8: .single() returned. Type: ${typeof singleQueryPromiseBuilder}, IsPromiseLike:`, singleQueryPromiseBuilder && typeof singleQueryPromiseBuilder.then === 'function');
    
    if (singleQueryPromiseBuilder && typeof singleQueryPromiseBuilder.then === 'function') {
        console.log(`AuthContext: User ${userId} - Step 9: Result of .single() is Promise-like.`);
    } else {
        console.error(`AuthContext: User ${userId} - Error after Step 8: Result of .single() is NOT Promise-like. Type: ${typeof singleQueryPromiseBuilder}, Value:`, singleQueryPromiseBuilder);
        setUserProfile(null); return;
    }

    console.log(`AuthContext: User ${userId} - Step 10: QUERY FULLY CONSTRUCTED. Awaiting promise with timeout.`);
    try {
      const timeoutDuration = 15000; 
      
      // Explicitly convert the PostgrestBuilder (thenable) to a true Promise
      const truePromise = Promise.resolve(singleQueryPromiseBuilder) as Promise<SupabaseProfileResponse>;

      const result = await fetchWithTimeout(
        truePromise, 
        timeoutDuration,
        userId,
        `Supabase profile fetch query for user ${userId}`
      );
      const { data, error, status } = result;

      console.log(`AuthContext: User ${userId} - Step 11: POST-QUERY. Supabase call attempt completed. Status: ${status}, Error: ${error ? JSON.stringify(error) : 'null'}`);

      if (error && status !== 406) {
        console.error(`AuthContext: User ${userId} - Error fetching user profile data:`, error);
        setUserProfile(null);
        return;
      }

      if (data) {
        console.log(`AuthContext: User ${userId} - Profile data successfully fetched.`);
        setUserProfile(data);
      } else {
        console.log(`AuthContext: User ${userId} - No profile data found. Status: ${status}. Clearing profile.`);
        setUserProfile(null);
      }
    } catch (e) {
      console.error(`AuthContext: User ${userId} - Exception during awaiting Supabase call or timeout:`, e);
      setUserProfile(null);
    }
    console.log(`AuthContext: fetchUserProfile finished processing for user ID: ${userId}.`);
  }, []);

  useEffect(() => {
    let isMounted = true;
    // setLoading(true) is done at useState initialization.
    // The first onAuthStateChange event (e.g. INITIAL_SESSION, SIGNED_IN, or SIGNED_OUT)
    // will be responsible for setting loading to false.
    console.log("AuthContext: useEffect mounted. Initial loading state is true.");

    // Check initial session for logging and to see if Supabase client is responsive.
    // However, onAuthStateChange will be the primary mechanism for updating state.
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (isMounted) {
        console.log(`AuthContext: Initial getSession completed. Session ${initialSession ? 'found' : 'not found'}. User: ${initialSession?.user?.id || 'N/A'}`);
        // If there's no session, onAuthStateChange should also fire with SIGNED_OUT or INITIAL_SESSION (if configured for null user)
        // and will handle setting loading to false. If there IS a session, onAuthStateChange will fire with SIGNED_IN/INITIAL_SESSION.
        // This block doesn't change loading state directly; it relies on onAuthStateChange.
      }
    }).catch(error => {
      if (isMounted) {
        console.error("AuthContext: Error during initial getSession:", error);
        // If getSession fails, it's a significant issue.
        // We should clear state and stop loading to prevent app hanging.
        setSession(null);
        setUser(null);
        setUserProfile(null);
        setLoading(false);
        console.log("AuthContext: Critical error in getSession. State cleared. Loading set to false.");
      }
    });

    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        if (!isMounted) {
          console.log("AuthContext: onAuthStateChange triggered on unmounted component. Ignoring.");
          return;
        }
        
        console.log(`AuthContext: onAuthStateChange event: ${_event}. Session user: ${currentSession?.user?.id || 'None'}.`);
        
        // Set loading to true before any async profile operations if not already true.
        // This ensures that even if a quick SIGNED_OUT followed by SIGNED_IN occurs,
        // the loading state is correctly managed.
        if (!loading) { // Only set to true if it was false, to avoid redundant logging if already true
            setLoading(true);
            console.log("AuthContext: onAuthStateChange - setting loading to true before processing.");
        }

        setSession(currentSession);
        const currentUser = currentSession?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          console.log(`AuthContext: User found (ID: ${currentUser.id}). Event: ${_event}. Proceeding to fetch profile.`);
          await fetchUserProfile(currentUser.id);
        } else {
          console.log(`AuthContext: No user for event ${_event}. Clearing profile.`);
          setUserProfile(null);
        }
        
        // After all processing for this auth event is done (including profile fetch or clear):
        if (isMounted) {
          setLoading(false);
          console.log(`AuthContext: onAuthStateChange processing complete for event ${_event}. Loading set to false. Profile: ${userProfile ? 'Loaded' : 'None'}`);
        }
      }
    );

    return () => {
      isMounted = false;
      if (authListener) {
        authListener.unsubscribe();
        console.log("AuthContext: Unsubscribed from auth state changes.");
      }
      console.log("AuthContext: useEffect cleanup. Component unmounted.");
    };
  }, [fetchUserProfile]); // Corrected dependency array

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      console.log("Sign out initiated successfully");
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = {
    session,
    user,
    userProfile,
    loading,
    fetchUserProfile,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the AuthContext
// This export is being removed to consolidate the useAuth hook into '@/hooks/useAuth.tsx'
// export const useAuth = (): AuthContextType => {
//   const context = useContext(AuthContext);
//   if (context === undefined) {
//     throw new Error('useAuth must be used within an AuthProvider');
//   }
//   return context;
// }; 