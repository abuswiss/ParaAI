import { supabase } from '../lib/supabaseClient';
import {
  addMessageSafely, 
  getConversationMessagesSafely 
} from '../lib/secureDataClient';
import { Message as ChatMessage } from '@/components/chat/ChatMessage'; 
import { Message as VercelChatMessage } from 'ai';
import { v4 as uuidv4 } from 'uuid';

console.log('Message service initializing...');

// Placeholder for message-related functions 

// --- Moved functions from chatService.ts ---

/**
 * Get messages for a conversation
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

/**
 * Add a message to a conversation
 */
export const addMessage = async (
  conversationId: string,
  role: 'system' | 'user' | 'assistant' | 'error', // Added 'error' role if used
  content: string
): Promise<{ data: ChatMessage | null; error: Error | null }> => {
  try {
    const result = await addMessageSafely(conversationId, role, content);
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error adding message';
    console.error('Error adding message:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
};

// Function to map our Message type to Vercel AI SDK Message type
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
 */
export const saveMessage = async (
  message: ChatMessage
): Promise<{ data: any | null; error: Error | null }> => {
  // Omit fields that shouldn't be directly saved or are handled by the DB
  const { isLoading, isStreaming, ...messageToSave } = message;

  // Map documentContext (if exists) to appropriate DB column if needed,
  // or ensure your DB schema accepts it directly on the 'messages' table.
  // Example: if DB column is 'document_context_id':
  // if (messageToSave.documentContext) {
  //    messageToSave.document_context_id = messageToSave.documentContext;
  //    delete messageToSave.documentContext; 
  // }

  // Ensure required fields are present
  if (!messageToSave.id || !messageToSave.conversation_id || !messageToSave.role || !messageToSave.content) {
    console.error('Missing required fields in message object for saving:', messageToSave);
    return { data: null, error: new Error('Invalid message object for saving.') };
  }

  try {
    console.log("Saving message:", messageToSave);
    
    // Prepare metadata object
    const metadataPayload: Record<string, any> = {};
    if (messageToSave.model) {
        metadataPayload.model = messageToSave.model;
    }
    if (messageToSave.documentContext) {
        metadataPayload.documentContextId = messageToSave.documentContext; // Store as documentContextId inside metadata
    }

    const { data, error } = await supabase
      .from('messages')
      .insert([{
          id: messageToSave.id,
          conversation_id: messageToSave.conversation_id,
          role: messageToSave.role,
          content: messageToSave.content,
          // Remove direct insertion of model and document_context
          // model: messageToSave.model, 
          // document_context: messageToSave.documentContext ?? null, 
          // Insert the constructed metadata object (or null if empty)
          metadata: Object.keys(metadataPayload).length > 0 ? metadataPayload : null,
          // Add owner_id if available and needed (assuming it comes from auth)
          // owner_id: (await supabase.auth.getUser()).data.user?.id, 
          // timestamp / created_at might be handled by DB defaults
      }])
      .select() 
      .single();

    if (error) {
        // Handle potential primary key violation (message ID already exists)
        if (error.code === '23505') { // PostgreSQL unique violation code
            console.warn(`Message with ID ${messageToSave.id} likely already saved. Ignoring duplicate insert error.`);
            // Optionally, fetch the existing message instead of returning an error
            const { data: existingMsg, error: fetchErr } = await supabase
                .from('messages')
                .select('*')
                .eq('id', messageToSave.id)
                .single();
            if (fetchErr) {
                 console.error("Failed to fetch existing message after duplicate insert attempt:", fetchErr);
                 return { data: null, error: fetchErr }; 
            }
            return { data: existingMsg, error: null }; // Return existing message
        } else {
             throw error; // Re-throw other errors
        }
    }
    
    return { data, error: null };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error saving message';
    console.error('Error saving message:', errorMessage, message);
    return { data: null, error: error instanceof Error ? error : new Error(errorMessage) };
  }
}; 