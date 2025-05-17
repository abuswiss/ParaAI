import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { OpenAI } from "npm:openai@^4.0.0";
// Remove Vercel AI library stream helpers
// import { OpenAIStream, StreamingTextResponse } from 'npm:ai@^3.1.32'; 
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@^2.0.0';
import { v4 as uuidv4 } from "npm:uuid"; // Import uuid

// --- Database Interaction Types (Moved to top level) ---
interface DbConversation {
    id: string;
    title?: string;
    case_id: string;
    owner_id: string;
    created_at?: string;
    updated_at?: string;
}

interface DbMessage {
    id: string;
    conversation_id: string;
    owner_id: string;
    role: 'system' | 'user' | 'assistant' | 'error';
    content: string;
    model?: string;
    metadata?: Record<string, any> | null;
    created_at?: string; 
}

// Reinstated Configuration Constants
const MAX_TOTAL_TOKENS_APPROX = 16000; // Keep overall limit

// Define types for the expected request body and context
interface ChatRequestBody {
  messages: { role: 'system' | 'user' | 'assistant'; content: string, id?: string }[]; // Add optional id
  modelId?: string;
  caseId?: string;
  conversationId?: string; // Add conversationId
  documentContextIds?: string[]; // Rename from documentContext
  // Remove analysisContext for now, focus on core chat
  // analysisContext?: {
  //   analysisType: string;
  //   analysisItem: any;
  //   documentText: string;
  // } | null;
  streamThoughts?: boolean; // Option to enable/disable thought streaming
}

// Helper to roughly estimate token count
function estimateTokens(text: string | null | undefined): number {
    return Math.ceil((text || '').length / 3.5);
}

// Helper to format the analysis item for the prompt
function formatAnalysisItem(item: any, type: string): string {
  if (!item) return 'N/A';
  try {
    // Keep original logic without explicit type checks, relying on 'any'
    switch(type) {
      case 'clauses': return `Clause Title: ${item.title || 'N/A'}\nClause Text: "${item.text || 'N/A'}"\nAnalysis: ${item.analysis || 'N/A'}`;
      case 'risks': return `Risk Title: ${item.title || 'N/A'}\nSeverity: ${item.severity || 'N/A'}\nExplanation: ${item.explanation || 'N/A'}${item.suggestion ? '\nSuggestion: ' + item.suggestion : ''}`;
      case 'entities': return `Entity Text: "${item.text || 'N/A'}"\nEntity Type: ${item.type || 'N/A'}`;
      case 'timeline': return `Date: ${item.date ? new Date(item.date).toLocaleDateString() : 'N/A'}\nEvent: ${item.event || 'N/A'}${item.type ? '\nType: ' + item.type : ''}`;
      case 'privilegedTerms': return `Term: "${item.text || 'N/A'}"\nCategory: ${item.category || 'N/A'}\nReason: ${item.explanation || 'N/A'}`;
      case 'summary': return `Summary Focus: ${item.summaryAnalysis || 'Overall Summary Provided'}`;
      default: if (typeof item === 'string') return item; return JSON.stringify(item, null, 2).substring(0, 500);
    }
  } catch (e) {
      console.error(`Error formatting analysis item type ${type}:`, e);
      return 'Error formatting item.';
  }
}

console.log('Generic Chat Agent function initializing (Refactored)...')

// Initialize Supabase client (unchanged)
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}
const supabaseAdmin: SupabaseClient = createClient(supabaseUrl!, supabaseServiceKey!, {
    global: { headers: { Authorization: `Bearer ${supabaseServiceKey!}` } },
    auth: { persistSession: false }
});

// --- Main Serve Function --- 
serve(async (req: Request) => {
  // --- CORS Handling --- 
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let userId: string | null = null;
  let newConversationId: string | null = null; // Track if a new conv is created

  try {
    // --- Authorization --- 
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
        console.warn('Missing Authorization header');
        return new Response(JSON.stringify({ error: 'Missing authorization token' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    // Use admin client to validate token and get user
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
        console.error('Auth Error:', userError?.message || 'User not found for token');
        return new Response(JSON.stringify({ error: userError?.message || 'Invalid token or user not found' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    userId = user.id;
    console.log('User authenticated:', userId);

    // --- Request Body Parsing --- 
    const { 
        messages,
        modelId = 'gpt-4o',
        caseId,
        conversationId: conversationIdFromRequest,
        documentContextIds, 
        streamThoughts,
    }: ChatRequestBody = await req.json();

    console.log(`Request: user=${userId}, model=${modelId}, msgs=${messages.length}, case=${caseId}, conv=${conversationIdFromRequest}, ctxIds=${documentContextIds?.length}`);

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
        return new Response(JSON.stringify({ error: 'Invalid last message. Expected user message.' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // --- Conversation Management ---
    let conversationId: string | null = null; // Initialize as null
    if (conversationIdFromRequest) { // Assign if exists
        conversationId = conversationIdFromRequest;
    }
    let conversation: DbConversation | null = null;

    if (conversationId) { // Check if we have an ID (either from request or will be set after creation)
        // Fetch existing conversation - RLS *should* handle access control on the client
        // but we use service key here, so double check owner?
        const { data: convData, error: convError } = await supabaseAdmin
            .from('conversations')
            .select('*')
            .eq('id', conversationId)
            // .eq('owner_id', userId) // RLS should enforce this, but belt-and-suspenders?
            .maybeSingle(); // Use maybeSingle to handle null case gracefully

        if (convError) {
            console.error(`Error fetching conversation ${conversationId}:`, convError);
            return new Response(JSON.stringify({ error: 'Failed to retrieve conversation details' }), {
                status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        if (!convData) {
             // If ID from request not found, set conversationId back to null
             // so we proceed to creation block IF caseId exists.
             console.warn(`Conversation ${conversationId} not found. Clearing ID to potentially create new.`);
             conversationId = null; 
        } else if (convData.owner_id !== userId) {
             console.error(`User ${userId} attempted to access conversation ${conversationId} owned by ${convData.owner_id}`);
             return new Response(JSON.stringify({ error: 'Access denied to conversation' }), {
                 status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
             });
        } else {
           conversation = convData as DbConversation;
           console.log(`Using existing conversation: ${conversationId}`);
        }
    } 
    
    // Create new conversation ONLY if conversationId is currently null AND we have a caseId
    if (!conversationId && caseId) {
        // Create new conversation if no ID provided but caseId exists
        const firstUserMessageContent = lastMessage.content.substring(0, 50);
        const title = `Chat: ${firstUserMessageContent}...`;
        const newConvData: Partial<DbConversation> = {
            title: title,
            case_id: caseId,
            owner_id: userId,
            // id will be generated by DB
        };
        const { data: createData, error: createError } = await supabaseAdmin
            .from('conversations')
            .insert(newConvData)
            .select()
            .single();

        if (createError || !createData) {
            console.error('Error creating conversation:', createError);
            return new Response(JSON.stringify({ error: 'Failed to create conversation' }), {
                status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        conversation = createData as DbConversation;
        conversationId = conversation.id; // Assign the NEW ID
        newConversationId = conversation.id; // Mark that we created a new one
        console.log(`Created new conversation ${conversationId} for case ${caseId}`);
    }

    // Check conversationId after potential retrieval/creation
    if (!conversationId) {
         // This means no ID was provided AND (no caseId was provided OR creation failed)
         console.error('Could not establish conversation ID. Missing initial ID or caseId, or creation failed.');
         return new Response(JSON.stringify({ error: 'Missing conversation ID or caseId to start chat, or creation failed.' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
    }
    // --> Now conversationId is guaranteed to be a string <--
    const finalConversationId: string = conversationId;

    // --- Save User Message --- 
    const userMessage = lastMessage; 
    const userMessageId = userMessage.id || uuidv4();
    const userMessageToSave: Omit<DbMessage, 'created_at'> = {
        id: userMessageId, 
        conversation_id: finalConversationId, // Use the guaranteed string variable
        owner_id: userId!,
        role: 'user',
        content: userMessage.content,
    };
    
    const { error: saveUserMsgError } = await supabaseAdmin
        .from('messages')
        .insert(userMessageToSave);
    
    if (saveUserMsgError) {
        // Log error but proceed? Or fail request?
        // If it's a unique constraint violation (23505), maybe ignore it?
        if (saveUserMsgError.code === '23505') {
            console.warn(`User message ${userMessageId} might already exist. Ignoring duplicate insert error.`);
        } else {
            console.error("Error saving user message:", saveUserMsgError);
            // Decide if this is fatal
             return new Response(JSON.stringify({ error: 'Failed to save user message' }), {
                 status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
             });
        }
    } else {
        console.log(`User message saved: ${userMessageId}`);
    }


    // --- Fetch Document Context --- 
    let fetchedContextText = '';
    const currentCaseId = caseId; 
    if (documentContextIds && documentContextIds.length > 0 && currentCaseId) {
        console.log(`Fetching context for ${documentContextIds.length} document(s) in case ${currentCaseId}`);
        try {
            const { data: docsData, error: docsError } = await supabaseAdmin
                .from('documents')
                .select('id, filename, extracted_text')
                .in('id', documentContextIds)
                .eq('case_id', currentCaseId) 
                .eq('owner_id', userId!) 
                .neq('processing_status', 'text_extraction_pending')
                .neq('processing_status', 'text_extraction_failed');

            if (docsError) throw docsError;

            if (docsData && docsData.length > 0) {
                 fetchedContextText = "\n\n--- Relevant Document Context ---\n";
                 let fetchedCount = 0;
                 docsData.forEach(doc => {
                     if (doc.extracted_text) {
                         fetchedContextText += `\n[Document: ${doc.filename} (ID: ${doc.id})]\n`;
                         const MAX_CONTEXT_TOKENS_PER_DOC = 1500;
                         let currentTokens = 0;
                         const lines = doc.extracted_text.split('\n');
                         for (const line of lines) {
                             const lineTokens = estimateTokens(line);
                             if (currentTokens + lineTokens <= MAX_CONTEXT_TOKENS_PER_DOC) {
                                 fetchedContextText += line + "\n";
                                 currentTokens += lineTokens;
                             } else {
                                 fetchedContextText += "... [Truncated]\n";
                                 break;
                             }
                         }
                         fetchedCount++;
                     } else {
                          fetchedContextText += `\n[Document: ${doc.filename} (ID: ${doc.id}) - Text not available or extraction pending/failed]\n`;
                     }
                 });
                 fetchedContextText += "\n--- End Document Context ---\n";
                  console.log(`Added context from ${fetchedCount}/${docsData.length} documents.`);
             } else {
                 console.log('No documents found or accessible for the provided IDs in this case.');
                 fetchedContextText = "\n\n[Selected documents not found or text not available]\
";
             }
         } catch (docError) {
             console.error('Error fetching document context:', docError);
             fetchedContextText = "\n\n[Error fetching document context]\n";
         }
     }

    // --- Build Prompt --- 
    let systemPromptContent = `You are a helpful AI paralegal assistant. Your primary goal is to provide accurate and concise answers.`;

    if (req.headers.get("X-Experimental-Stream-Thoughts") === "true" || streamThoughts) {
      systemPromptContent += `
When responding, first outline your thought process step-by-step. Prefix each step of your thought process with "THOUGHT: ".
Each thought should be on a new line.
After you have laid out your thought process, provide the final answer to the user, prefixed with "FINAL_ANSWER: ".

Example:
THOUGHT: The user is asking about contract law.
THOUGHT: I need to consider the jurisdiction mentioned.
THOUGHT: I will look up relevant statutes for that jurisdiction.
FINAL_ANSWER: Based on the statutes of [Jurisdiction], ...`;
    }

    const finalSystemPrompt = `${systemPromptContent}${fetchedContextText}`;
    
    // Prepare messages for OpenAI, including the system prompt
    // Exclude IDs when sending to OpenAI
    const historyMessages = messages.map(({ role, content }) => ({ role, content }));
    const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: finalSystemPrompt },
        ...historyMessages 
    ];
    // TODO: Implement token limit calculation for history messages similar to previous version
    console.log(`Final Prompt: System tokens approx=${estimateTokens(finalSystemPrompt)}, History msgs=${historyMessages.length}`);


    // --- Call OpenAI --- 
    const getApiKey = (keyName: string) => {
        const key = Deno.env.get(keyName);
        if (!key) throw new Error(`${keyName} not set in environment variables`);
        return key;
    };

    // Declare modelId outside try block to be accessible in catch
    let actualModelId = 'gpt-4o'; // Default value

    try {
        const openai = new OpenAI({ apiKey: getApiKey('OPENAI_API_KEY') });
        // Correct the default model name
        const defaultModel = 'gpt-4o'; // Changed from gpt-4o-mini
        // Assign the final model ID
        actualModelId = modelId === 'default-chat' ? defaultModel : (modelId || defaultModel);
        console.log(`Calling OpenAI (${actualModelId}) with streaming...`);
        
        const responseIterator = await openai.chat.completions.create({
            model: actualModelId,
            messages: openAiMessages,
            temperature: 0.7,
            stream: true,
        });

        // --- Return RAW OpenAI Stream --- 
        const responseStream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            console.log('DEBUG: Stream adapter started.');
            let buffer = ""; 
            let currentStreamType = "0";
            // Use the streamThoughts destructured from req.json() which should be in scope here
            // const enableStreamThoughts = req.headers.get("X-Experimental-Stream-Thoughts") === "true" || streamThoughts;
            // Corrected: Ensure we are using the 'streamThoughts' variable from the outer scope (destructured from req.json())
            // The 'streamThoughts' on the right side of || in the original code was correctly referring to this.
            // Let's keep the original logic for `isStreamingThoughtsEnabled` for now as it seemed correct.
            const isStreamingThoughtsEnabled = req.headers.get("X-Experimental-Stream-Thoughts") === "true" || streamThoughts; // This 'streamThoughts' is from req.json()

            let chunkCounter = 0; // To count incoming chunks

            try {
              console.log(`DEBUG: Starting stream processing loop. streamThoughts enabled: ${isStreamingThoughtsEnabled}`);
              for await (const chunk of responseIterator) {
                chunkCounter++;
                const deltaContent = chunk.choices?.[0]?.delta?.content || "";
                const finishReason = chunk.choices?.[0]?.finish_reason;

                console.log(`DEBUG: Chunk ${chunkCounter} received. Delta: "${deltaContent}", Finish Reason: ${finishReason}`);
                
                buffer += deltaContent;
                // Temporarily log the full buffer for intense debugging if needed, then revert to substring
                // console.log(`DEBUG: Chunk ${chunkCounter} - Buffer now (full): "${buffer}"`); 
                console.log(`DEBUG: Chunk ${chunkCounter} - Buffer now: "${buffer.substring(0, 200)}${buffer.length > 200 ? '...' : ''}"`);


                if (isStreamingThoughtsEnabled) {
                  // Process thoughts
                  let thoughtMatch;
                  while ((thoughtMatch = buffer.match(/^THOUGHT: (.*?)(?:\n|$)/)) !== null) {
                    const thoughtContent = thoughtMatch[1].trim();
                    if (thoughtContent) { // Ensure we don't send empty thoughts
                        const formattedThought = `4:"${JSON.stringify(thoughtContent).slice(1, -1)}"\n`;
                        controller.enqueue(encoder.encode(formattedThought));
                        console.log(`DEBUG: Sent thought chunk: ${thoughtContent}`);
                    }
                    const processedPart = thoughtMatch[0];
                    buffer = buffer.substring(processedPart.length); // Consume the THOUGHT line from buffer
                    buffer = buffer.trimStart(); 
                    currentStreamType = "0"; // Reset type, though content might not be sent immediately
                    console.log(`DEBUG: Processed thought. Buffer remaining: "${buffer.substring(0, 100)}${buffer.length > 100 ? '...' : ''}"`);
                  }

                  // Check for final answer marker
                  if (buffer.startsWith("FINAL_ANSWER:")) {
                    const marker = "FINAL_ANSWER:";
                    buffer = buffer.substring(marker.length).trimStart(); // Consume the FINAL_ANSWER: marker from buffer
                    currentStreamType = "0"; // Ensure final answer is streamed as content type '0'
                    console.log(`DEBUG: FINAL_ANSWER marker processed. Buffer remaining: "${buffer.substring(0, 100)}${buffer.length > 100 ? '...' : ''}"`);
                  }
                }
                
                // Stream content if any is available in the buffer
                let contentToStream = "";
                if (isStreamingThoughtsEnabled) {
                    // If streaming thoughts, only send if not starting with a new THOUGHT: marker
                    // (FINAL_ANSWER: marker is already stripped if it was present)
                    let splitPoint = buffer.length;
                    const nextThoughtMarker = buffer.indexOf("THOUGHT:");
                    // No need to check for FINAL_ANSWER: here again, it's a prefix for the whole answer block.
                    if (nextThoughtMarker !== -1) {
                        splitPoint = Math.min(splitPoint, nextThoughtMarker);
                    }
                    contentToStream = buffer.substring(0, splitPoint);
                } else {
                    // If not streaming thoughts, send everything in buffer
                    contentToStream = buffer;
                }
                
                if (contentToStream.length > 0) {
                    const formattedContent = `${currentStreamType}:"${JSON.stringify(contentToStream).slice(1, -1)}"\n`;
                    controller.enqueue(encoder.encode(formattedContent));
                    const bufferBeforeContentSent = buffer; // For logging
                    buffer = buffer.substring(contentToStream.length);
                    // console.log(`DEBUG: Sent content (type ${currentStreamType}): "${contentToStream.substring(0,100)}${contentToStream.length > 100 ? '...' : ''}". Original Buffer: "${bufferBeforeContentSent.substring(0,100)}...". New Buffer remaining: "${buffer.substring(0, 100)}${buffer.length > 100 ? '...' : ''}"`);
                    console.log(`DEBUG: Sent content (type ${currentStreamType}): "${contentToStream}". New Buffer remaining: "${buffer}"`);

                }

                if (finishReason) {
                  console.log(`DEBUG: OpenAI stream finished with reason: ${finishReason}.`);
                  break; // Exit loop if OpenAI signals completion
                }
              }
              console.log(`DEBUG: Stream processing loop finished. Total chunks: ${chunkCounter}.`);

              // Clean up any remaining THOUGHT: or FINAL_ANSWER: lines in the buffer before final flush (defensive)
              if (isStreamingThoughtsEnabled && buffer.length > 0) {
                const originalBuffer = buffer;
                buffer = buffer
                  .split('\n')
                  .filter(line => !line.trim().startsWith('THOUGHT:') && !line.trim().startsWith('FINAL_ANSWER:'))
                  .join('\n')
                  .trim();
                if (buffer !== originalBuffer) {
                  console.log(`DEBUG: Cleaned buffer before final flush.\nOriginal:\n${originalBuffer}\nCleaned:\n${buffer}`);
                }
              }

              if (buffer.length > 0) {
                if (isStreamingThoughtsEnabled && (buffer.startsWith("THOUGHT:") || buffer.startsWith("FINAL_ANSWER:"))) {
                    console.warn(`DEBUG: Buffer has remaining marker at end of stream loop: "${buffer.substring(0, 200)}${buffer.length > 200 ? '...' : ''}"`);
                }
                const finalFormattedContent = `0:"${JSON.stringify(buffer).slice(1, -1)}"\n`;
                controller.enqueue(encoder.encode(finalFormattedContent));
                console.log(`DEBUG: Flushed remaining buffer content: "${buffer.substring(0, 200)}${buffer.length > 200 ? '...' : ''}"`);
                buffer = ""; // Clear buffer after flushing
              }
              console.log('DEBUG: Stream adapter logic completed successfully.');
            } catch (streamErr) {
              console.error('DEBUG: ERROR INSIDE stream processing logic:', streamErr);
              controller.error(streamErr); 
            } finally {
              controller.close();
              console.log('DEBUG: Stream adapter controller closed (finally block).');
            }
          },
          cancel(reason) {
              console.log('DEBUG: Stream cancelled. Reason:', reason);
          }
        });

        // Add the new conversation ID to the stream headers if it was just created
        const responseHeaders = { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' };
        if (newConversationId) {
            responseHeaders['X-Conversation-Id'] = newConversationId;
             console.log("Sending new conversation ID in header:", newConversationId);
        }

        console.log('DEBUG: Returning standard Response with stream.');
        return new Response(responseStream, {
            headers: responseHeaders,
            status: 200
        });

    } catch (llmError) {
        console.error(`OpenAI API Error (${actualModelId}):`, llmError); // Now accessible
        const errorMessage = llmError instanceof Error ? llmError.message : 'Unknown OpenAI API error';
        const isModelAccessError = llmError instanceof Error && llmError.message.includes('does not exist or you do not have access to it');
        const status = isModelAccessError ? 404 : 502; 
        return new Response(JSON.stringify({ error: `LLM API Error: ${errorMessage}` }), {
            status: status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    // --- General Error Handling --- 
    console.error('Error in generic-chat-agent:', error)
    const errorMessage = error instanceof Error ? error.message : 'An internal server error occurred.';
    // Avoid sending back detailed internal errors unless necessary
    const publicErrorMessage = errorMessage.startsWith('Auth Error:') || errorMessage.startsWith('LLM API Error:') ? errorMessage : 'Internal Server Error';
    const status = error.status || 500; // Use error status if available

    return new Response(JSON.stringify({ error: publicErrorMessage }), {
      status: status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

console.log('Generic Chat Agent function ready (Refactored).') 