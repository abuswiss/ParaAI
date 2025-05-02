import { type SourceInfo } from '@/types/sources';
import { supabase } from './supabaseClient'; // Assuming supabase client is needed here

console.log('Streaming utils initializing...');

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
    try {
        console.log(`Invoking streaming function: ${functionName}`);
        const { data: responseData, error: invokeError } = await supabase.functions.invoke(functionName, {
            body: payload,
        });

        if (invokeError) throw invokeError;
        if (!responseData) throw new Error('Function invocation returned no data.');

        // Handle direct string response
        if (typeof responseData === 'string') {
            console.warn(`Received string directly from ${functionName}, processing as single chunk.`);
            accumulatedResponse = chunkParser(responseData, onChunk);
            // Note: Cannot determine sources reliably from a direct string response
            return { success: true, error: null, fullResponse: accumulatedResponse, sources: undefined }; 
        }

        // Handle potential error object returned in data
        if (responseData?.error && typeof responseData.error === 'object') {
             // Define a more specific type for the error object
             type SupabaseFunctionError = { message?: string; [key: string]: unknown };
             const errorObj = responseData.error as SupabaseFunctionError;
             console.error(`Supabase function ${functionName} returned error object:`, errorObj);
             throw new Error(errorObj.message || JSON.stringify(errorObj));
        }

        // Ensure we have a ReadableStream
        if (!(responseData instanceof ReadableStream)) {
            let receivedDataInfo = 'Unknown structure';
            try { receivedDataInfo = JSON.stringify(responseData); } catch { /* Ignore */ }
            console.error(`Unexpected response type from ${functionName}: Expected ReadableStream, got ${typeof responseData}. Data: ${receivedDataInfo}`);
            throw new Error('Unexpected response type received from streaming function.');
        }

        // Process the stream
        const stream = responseData;
        const reader = stream.getReader();
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
    const lines = chunkText.split('\n');

    for (const line of lines) {
        if (line.trim() === '') continue;

        if (line.startsWith('data:')) {
            const dataContent = line.substring(5).trim();
            if (dataContent === '[DONE]') {
                continue; // Ignore DONE signal
            }
            // Assume data content is the text chunk
            onChunk(dataContent);
            accumulatedContent += dataContent;
        } else if (!line.startsWith('event:')) { // Ignore event lines unless handled elsewhere
            // Treat as plain text line if not data or event
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