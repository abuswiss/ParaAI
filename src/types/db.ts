export interface BaseDbFields {
    id: string;
    created_at: string; // Keep for reading/display, but DB will set on insert
}

export interface UserProfile extends BaseDbFields {
    // Add user profile specific fields if needed
    // Example: username, full_name, avatar_url
}

export interface Case extends BaseDbFields {
    name?: string | null;
    case_number?: string | null;
    client_name?: string | null;
    status?: string | null;
    owner_id: string; // Cases have an owner
    // Add other case specific fields
}

export interface Conversation extends BaseDbFields {
    title?: string | null;
    case_id: string;
    owner_id: string; // Conversations also have an owner
}

export type MessageRole = 'system' | 'user' | 'assistant' | 'error';

export interface Message extends BaseDbFields {
    conversation_id: string;
    // Use sender_id based on schema analysis
    sender_id: string; // Renamed from owner_id
    role: MessageRole;
    content: string;
    model?: string | null;
    document_context?: string | null; // Comma-separated IDs or specific format?
    metadata?: Record<string, any> | null;
    // owner_id?: string; // Removed if sender_id is the correct one
    // timestamp?: string; // Add if needed, DB has default
}

// ... other types ... 