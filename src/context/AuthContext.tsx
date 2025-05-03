import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient'; // Import your configured Supabase client

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
          console.log("Initial session check:", session ? "Session found" : "No session");
      }
    }).catch(error => {
        console.error("Error getting initial session:", error);
        if (isMounted) setLoading(false);
    });

    // Listen for auth state changes
    const { 
        data: { subscription: authListener }
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (isMounted) {
            console.log(`Auth state changed: ${_event}`, session ? "New session" : "Logged out");
            setSession(session);
            setUser(session?.user ?? null);
             if(loading) setLoading(false);
        }
      }
    );

    // Cleanup listener on unmount
    return () => {
      isMounted = false;
      authListener?.unsubscribe();
    };
  }, []); // Run only once on mount

  const signOut = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
       // State updates are handled by onAuthStateChange listener
       console.log("Sign out successful");
    } catch (error) {
        console.error("Error signing out:", error);
    } finally {
        // Ensure loading is set to false even if listener doesn't fire immediately
        // Although the listener *should* handle setting session/user to null
        if(session) setSession(null);
        if(user) setUser(null);
        setLoading(false);
    }
  };

  const value = {
    session,
    user,
    loading,
    signOut,
  };

  // Don't render children until initial auth check is complete
  // Or show a loading indicator here if preferred
  // if (loading) {
  //   return <div>Loading Authentication...</div>; 
  // }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the AuthContext
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 