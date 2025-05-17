import { type SourceInfo } from '@/types/sources';
import { supabase } from './supabaseClient'; // Assuming supabase client is needed here
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import React from 'react'; // Needed for JSX in ToastAction

console.log('Streaming utils initializing...');

// Custom error class for subscription issues
export class SubscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubscriptionError';
  }
}

// --- Stream Processing Helpers (Moved from agentService.ts) ---

/**
 * Helper for processing SSE Streams from Supabase Functions.
 * Handles direct string responses and different parsing strategies.
 */
export async function processSupabaseStream(
    functionName: string,
    payload: Record<string, any>,
    onChunk: (chunk: string) => void,
    onSnippets?: (snippets: SourceInfo[]) => void, // Optional: Specific handler for snippet events
    onError?: (errorMessage: string) => void, // Optional: Specific handler for error events/stream failures
    chunkParser: (chunkText: string, onChunk: (content: string) => void) => string = parseGenericStreamChunks // Default parser
): Promise<{ success: boolean; error: Error | null; fullResponse: string; sources?: SourceInfo[] }> {
    let accumulatedResponse = '';
    let receivedSources: SourceInfo[] | undefined = undefined; // Store sources if onSnippets is used
    let responseStream: ReadableStream | null = null;

    try {
        console.log(`Invoking streaming function via fetch: ${functionName}`);

        // --- Use fetch instead of invoke --- 
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
            throw new Error(sessionError.message);
        }
        
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL; 
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY; 

        if (!supabaseUrl || !anonKey) {
             throw new Error('Supabase URL or Anon Key is not configured in environment variables.');
        }
        
        const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            apikey: anonKey,
        };
        if (session && session.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const response = await fetch(functionUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });
        // --- End fetch logic --- 

        if (!response.ok) {
             const errorText = await response.text();
             console.error(`Function ${functionName} fetch failed (${response.status}): ${errorText}`);
             let errorJson: { error?: string } = {};
             try { errorJson = JSON.parse(errorText); } catch { /* ignore parse error */ }
             const errorMessage = errorJson.error || `Function call failed with status ${response.status}: ${errorText.substring(0,100)}`;

             if (response.status === 403) {
                console.warn(`Access Denied (403) from ${functionName}: ${errorMessage}`);
                // Attempt to parse the error message for better display
                let displayMessage = "Your trial may have expired or you've reached a usage limit.";
                if (errorMessage.toLowerCase().includes('trial has expired')) {
                    displayMessage = "Your trial has expired. Please subscribe to continue.";
                } else if (errorMessage.toLowerCase().includes('trial ai call limit')) {
                    displayMessage = "You've reached your trial AI call limit. Please subscribe.";
                } else if (errorMessage.toLowerCase().includes('active subscription required')) {
                    displayMessage = "An active subscription is required to use this feature.";
                }

                toast.error('Access Denied', {
                    description: `${displayMessage} Please visit settings to upgrade your plan.`,
                    icon: React.createElement(AlertTriangle, { className: 'h-5 w-5 text-red-500' }),
                    // Navigation should be handled by the component calling the service that uses this utility.
                    // We can't use useNavigate here directly.
                    // Action is commented out as direct navigation is not ideal from here.
                    // action: {
                    //   label: 'Go to Subscription',
                    //   onClick: () => { /* How to navigate? window.location.href = '/settings/subscription' could work but is a hard nav */ },
                    // },
                });
                throw new SubscriptionError(errorMessage); // Throw specific error
             }
             throw new Error(errorMessage);
        }

        // Check content type for streaming
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('text/event-stream')) {
            // Handle non-stream response (maybe an unexpected JSON error or string?)
            const responseText = await response.text();
            console.warn(`Received non-stream content-type (${contentType}) from ${functionName}. Body: ${responseText}`);
            // Try to parse as error JSON
            let errorJson: { error?: string } = {};
            try { errorJson = JSON.parse(responseText); } catch { /* ignore */ }
            if (errorJson.error) throw new Error(errorJson.error);
            // Otherwise, treat the whole text as a single chunk? Or throw error?
            accumulatedResponse = chunkParser(responseText, onChunk); // Attempt to parse as single chunk
            return { success: true, error: null, fullResponse: accumulatedResponse, sources: undefined }; 
        }

        // Get the stream from the response body
        responseStream = response.body; 
        if (!responseStream) {
            throw new Error('Response body is null, cannot get stream.');
        }
        
        // --- Stream Processing Logic (largely unchanged) ---
        const reader = responseStream.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            let currentLineIndex = 0;
            
            while (currentLineIndex < lines.length - 1) { // Process all complete lines
                const line = lines[currentLineIndex];
                 if (line.trim() === '') {
                    currentLineIndex++;
                    continue; 
                 }
                
                // Special handling for snippet events if handler provided
                if (line.startsWith('event: snippets') && onSnippets) {
                    const nextLineIndex = currentLineIndex + 1;
                    if (nextLineIndex < lines.length && lines[nextLineIndex].startsWith('data:')) {
                        const dataContent = lines[nextLineIndex].substring(5).trim();
                        try {
                            const jsonData = JSON.parse(dataContent);
                            receivedSources = jsonData as SourceInfo[]; 
                            onSnippets(receivedSources);
                            // Skip the event and data lines after handling
                            currentLineIndex += 2; 
                            continue; // Move to the next line after the data line
                        } catch (_error) {
                             console.warn('Failed to parse snippets data:', dataContent, _error);
                             // If parsing fails, fall through to default chunk parsing for the event/data lines
                        }
                    }
                } 
                // Use the provided parser for the current line if not handled as a snippet event
                accumulatedResponse += chunkParser(line, onChunk); 
                currentLineIndex++;
            }
             buffer = lines[lines.length - 1]; // Keep the last (potentially incomplete) line in buffer
        }
        // Process any remaining buffer content after the loop
        if (buffer.trim() !== '') {
            accumulatedResponse += chunkParser(buffer, onChunk);
        }
        
        console.log(`Stream finished for ${functionName}. Full response length: ${accumulatedResponse.length}`);
        return { success: true, error: null, fullResponse: accumulatedResponse, sources: receivedSources };
    } catch (e: unknown) {
        // Ensure the stream reader is cancelled if an error occurs
        if (responseStream) {
            try {
                await responseStream.cancel();
                console.log('Stream cancelled due to error.');
            } catch (cancelError) {
                console.error('Error cancelling stream:', cancelError);
            }
        }
        
        const error = e instanceof Error ? e : new Error(`Unknown error processing stream for ${functionName}`);
        console.error(`Error during stream processing for ${functionName}:`, error.message, e);
        const errorMessage = error.message;
        if (onError) {
             onError(errorMessage);
        } else {
             // Default error reporting via onChunk if no specific handler
             onChunk(`\n--- Stream Error: ${errorMessage} ---`);
        }
        return { success: false, error, fullResponse: accumulatedResponse, sources: receivedSources };
    }
}

/**
 * Default parser for generic text streams (handles potential SSE events like data: [DONE])
 */
export function parseGenericStreamChunks(chunkText: string, onChunk: (content: string) => void): string {
    let accumulatedContent = '';
    // Process the input chunkText directly, assuming it might contain one or more SSE lines
    const lines = chunkText.split('\n');

    for (const line of lines) {
        if (line.trim() === '') continue;

        if (line.startsWith('data:')) {
            const dataContent = line.substring(5).trim();
            if (dataContent === '[DONE]') {
                console.log('Received DONE signal');
                continue; // Ignore DONE signal
            }
            try {
                // Attempt to parse the data content as JSON (since OpenAI sends strings JSON-encoded)
                const parsedData = JSON.parse(dataContent);
                if (typeof parsedData === 'string') {
                    onChunk(parsedData);
                    accumulatedContent += parsedData;
                } else {
                     // Handle cases where data might not be a simple string after parsing
                     console.warn('Parsed SSE data is not a string:', parsedData);
                     const fallbackString = String(parsedData);
                     onChunk(fallbackString);
                     accumulatedContent += fallbackString;
                }
            } catch (e) {
                // If JSON parsing fails, treat the raw content as the chunk (might happen with direct strings or errors)
                console.warn('Failed to parse SSE data as JSON, using raw content:', dataContent, e);
                onChunk(dataContent);
                accumulatedContent += dataContent;
            }
        } else if (!line.startsWith('event:')) { // Ignore event lines unless handled elsewhere
            // This case should ideally not happen with our backend functions, but log if it does.
            console.warn("Received non-SSE line (treating as raw text):", line);
            onChunk(line);
            accumulatedContent += line;
        }
    }
    return accumulatedContent;
}

/**
 * Specific parser for Vercel AI SDK formatted chunks (0:"...")
 */
export function parseVercelAiSdkChunks(chunkText: string, onChunk: (content: string) => void): string {
    let accumulatedContent = '';
    const lines = chunkText.split('\n');

    for (const line of lines) {
        if (line.trim() === '') continue;

        const match = line.match(/^\d+:(.*)\r?$/);
        if (match && match[1]) {
            const escapedJsonString = match[1]; 
            try {
                const jsonString = escapedJsonString.replace(/"/g, '"');
                const parsedChunk = JSON.parse(jsonString);
                if (typeof parsedChunk === 'object' && parsedChunk !== null && typeof parsedChunk.content === 'string') {
                    const content = parsedChunk.content;
                    onChunk(content);
                    accumulatedContent += content;
                } else {
                    console.warn("Parsed valid JSON, but structure is unexpected (no 'content' string):", parsedChunk);
                    onChunk(jsonString); // Fallback to unescaped string
                    accumulatedContent += jsonString;
                }
            } catch (jsonParseError) {
                const rawContent = escapedJsonString.replace(/"/g, '"');
                console.warn('Failed to parse inner JSON, treating as raw text chunk:', rawContent, jsonParseError);
                onChunk(rawContent);
                accumulatedContent += rawContent;
            }
        } else {
            // If the line doesn't match the Vercel format, treat the whole line as raw text
            console.warn("Received chunk line in unexpected format (treating as raw text):", line);
            onChunk(line);
            accumulatedContent += line;
        }
    }
    return accumulatedContent;
} 