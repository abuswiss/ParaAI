import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { AuthState } from '../types/auth';

interface AuthContextProps {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
}

const initialState: AuthState = {
  session: null,
  user: null,
  loading: true,
  error: null,
};

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(initialState);

  useEffect(() => {
    const setupAuth = async () => {
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: { user } } = await supabase.auth.getUser();
          setState({ session, user, loading: false, error: null });
        } else {
          setState({ session: null, user: null, loading: false, error: null });
        }

        // Set up auth listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (_event, session) => {
            setState(prevState => ({ ...prevState, session }));

            if (session) {
              const { data: { user } } = await supabase.auth.getUser();
              setState({ session, user, loading: false, error: null });
            } else {
              setState({ session: null, user: null, loading: false, error: null });
            }
          }
        );

        return () => {
          subscription.unsubscribe();
        };
      } catch (error: unknown) {
        let message = 'Unknown error';
        if (error instanceof Error) message = error.message;
        setState(prevState => ({ 
          ...prevState, 
          error: message, 
          loading: false 
        }));
      }
    };

    setupAuth();
  }, []);

  const signOut = async () => {
    try {
      setState(prevState => ({ ...prevState, loading: true }));
      await supabase.auth.signOut();
      setState({ session: null, user: null, loading: false, error: null });
    } catch (error: unknown) {
      let message = 'Unknown error';
      if (error instanceof Error) message = error.message;
      setState(prevState => ({ 
        ...prevState, 
        error: message, 
        loading: false 
      }));
    }
  };

  const value = {
    session: state.session,
    user: state.user,
    loading: state.loading,
    error: state.error,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
