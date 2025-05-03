import { supabase } from '../lib/supabaseClient';
import {
  getConversationMessagesSafely 
} from '../lib/secureDataClient';
import { Message as ChatMessage } from '@/components/chat/ChatMessage'; 
import { Message as VercelChatMessage } from 'ai';
import { v4 as uuidv4 } from 'uuid';
import { Message as DbMessage } from '@/types/db'; 

console.log('Message service initializing...');

// Placeholder for message-related functions 

// --- Moved functions from chatService.ts ---

/**
 * Get messages for a conversation
 * Still used for loading initial history in ChatInterface
 */
export const getConversationMessages = async (
  conversationId: string
): Promise<{ data: any[] | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
        .from('messages')
        .select('*') // Select all columns for now
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

    if (error) throw error;
    return { data, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error getting messages';
    console.error('Error getting messages:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
};

// Function to map our Message type to Vercel AI SDK Message type
// Keep this if needed elsewhere, but useChat handles mapping internally for API calls
export function mapToVercelMessages(messages: ChatMessage[]): VercelChatMessage[] {
    return messages.map(msg => ({
        id: msg.id,
        role: msg.role === 'error' ? 'assistant' : msg.role, // Map error role to assistant for Vercel SDK compatibility
        content: msg.content,
        // Add other fields if needed
    }));
} 

// --- NEW saveMessage Function --- 
/**
 * Saves a complete message object to the database.
 * Expects an object compatible with the DB schema.
 */
export const saveMessage = async (
  message: DbMessage // <-- Expect DbMessage type
): Promise<{ data: DbMessage | null; error: Error | null }> => {
  
  const messageToSave = message;

  // Update validation check to use sender_id
  if (!messageToSave.id || !messageToSave.conversation_id || !messageToSave.role || !messageToSave.content || !messageToSave.sender_id) { // Check sender_id
    console.error('Missing required fields in message object for saving:', messageToSave);
    return { data: null, error: new Error('Invalid message object for saving (missing required fields). ID, conversation_id, role, content, sender_id needed.') };
  }

  try {
    console.log("Attempting to save message via saveMessage:", messageToSave);
    
    // Prepare metadata object 
    const metadataPayload: Record<string, any> = {};
    if (messageToSave.model) {
        metadataPayload.model = messageToSave.model;
    }
    if (messageToSave.document_context && typeof messageToSave.document_context === 'string') { 
        metadataPayload.documentContextIds = messageToSave.document_context;
    }
    if (messageToSave.metadata) {
        Object.assign(metadataPayload, messageToSave.metadata);
    }

    // Prepare the object for insertion, using sender_id and omitting DB-defaulted fields
    const dbPayload: Partial<DbMessage> = {
        id: messageToSave.id,
        conversation_id: messageToSave.conversation_id,
        // Use sender_id
        sender_id: messageToSave.sender_id, 
        role: messageToSave.role,
        content: messageToSave.content,
        // OMIT created_at - let DB handle default
        // created_at: messageToSave.created_at, 
        // OMIT timestamp - let DB handle default
        // timestamp: undefined, // Or however you handle this if it exists on DbMessage
        // Optional fields
        model: messageToSave.model, // Include if present
        document_context: messageToSave.document_context, // Include if present
        // Include metadata if the column exists and payload has keys or original metadata exists
        metadata: Object.keys(metadataPayload).length > 0 ? metadataPayload : (messageToSave.metadata !== undefined ? messageToSave.metadata : null), 
    };

    // Remove undefined fields before insert
    Object.keys(dbPayload).forEach(key => dbPayload[key as keyof DbMessage] === undefined && delete dbPayload[key as keyof DbMessage]);

    console.log("Final payload for DB insert:", JSON.stringify(dbPayload, null, 2));
    console.log("Payload Keys:", Object.keys(dbPayload));

    const { data, error } = await supabase
      .from('messages')
      .insert([dbPayload as DbMessage]) 
      .select() 
      .single();

    if (error) {
        // --- Log Supabase Error Details --- 
        console.error("Supabase Insert Error Details:", JSON.stringify(error, null, 2));
        // --- End Log --- 

        // Handle potential primary key violation (message ID already exists)
        if (error.code === '23505') { // PostgreSQL unique violation code
            console.warn(`Message with ID ${messageToSave.id} likely already saved (e.g., user message on retry). Ignoring duplicate insert error.`);
            // Fetch the existing message instead of returning an error
            const { data: existingMsg, error: fetchErr } = await supabase
                .from('messages')
                .select('*')
                .eq('id', messageToSave.id)
                .single();
            if (fetchErr) {
                 console.error("Failed to fetch existing message after duplicate insert attempt:", fetchErr);
                 return { data: null, error: fetchErr }; 
            }
            console.log("Returning existing message data for duplicate ID:", existingMsg);
            return { data: existingMsg, error: null }; // Return existing message
        } else {
             throw error; // Re-throw other errors
        }
    }
    
    console.log("Message saved successfully:", data);
    return { data, error: null };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error saving message';
    console.error('Error saving message:', errorMessage, message);
    return { data: null, error: error instanceof Error ? error : new Error(errorMessage) };
  }
}; 