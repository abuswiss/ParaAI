import { Session, User } from '@supabase/supabase-js';

export interface UserCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

export interface SignUpData extends UserCredentials {
  acceptTerms: boolean;
}
