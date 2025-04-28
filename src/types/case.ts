export interface Case {
  id: string;
  case_number: string | null;
  client_name: string | null;
  opposing_party: string | null;
  court: string | null;
  // Add other relevant case fields here if known
  // e.g., created_at?: string;
  // user_id?: string;
} 