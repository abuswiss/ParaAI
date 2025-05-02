import { supabase } from '../lib/supabaseClient';
import { processSupabaseStream, parseGenericStreamChunks } from '../lib/streamingUtils';

/**
 * Streams timeline generation results from the Supabase Edge Function 'generate-timeline'.
 * @param documentId - The document ID to generate a timeline for.
 * @param onChunk - Callback for each streamed chunk.
 * @param caseId - The case ID (optional for future use, not required by your current edge function).
 */
export async function handleGenerateTimelineStream(
  documentId: string,
  onChunk: (chunk: string) => void,
  caseId: string // Not used by your edge function, but kept for compatibility
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const payload = { documentId };
    const result = await processSupabaseStream(
      'generate-timeline',
      payload,
      onChunk,
      undefined,
      undefined,
      parseGenericStreamChunks
    );
    return { success: result.success, error: result.error };
  } catch (error) {
    onChunk(JSON.stringify({ status: 'ERROR', message: error instanceof Error ? error.message : String(error) }));
    return { success: false, error: error instanceof Error ? error : new Error('Unknown error') };
  }
} 