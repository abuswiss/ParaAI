import { Session, User } from '@supabase/supabase-js';

export interface UserCredentials {
  email: string;
  password: string;
}

export interface SignUpData extends UserCredentials {
  acceptTerms: boolean;
}
