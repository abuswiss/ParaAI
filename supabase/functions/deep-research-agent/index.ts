import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@^2.0.0';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2.0.0';
import { v4 as uuidv4 } from "npm:uuid";
// import Anthropic from 'npm:@anthropic-ai/sdk@0.19.0'; // Will be replaced by Perplexity
// import type { MessageParam } from 'npm:@anthropic-ai/sdk'; // Will be replaced by Perplexity

// --- Database Interaction Types (can remain similar) ---
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

// Request body interface - might need adjustment for Perplexity
interface DeepResearchRequestBody {
  messages: { role: 'system' | 'user' | 'assistant'; content: string; id?: string }[];
  caseId?: string;
  conversationId?: string;
  documentContextIds?: string[];
  activeDocumentId?: string; // May not be used by Perplexity in the same way
  preloadedContext?: string; // May not be used by Perplexity in the same way
  query?: string; 
  // streamThoughts?: boolean; // Perplexity might not have a direct 'thoughts' equivalent
}

// Source info for research results - Perplexity might have a different structure
interface SourceInfo {
  title: string;
  url: string;
  date?: string;
  snippet?: string;
  // Add any Perplexity specific source fields
}

console.log('Deep Research Agent function initializing...');

// Initialize Supabase client (remains the same)
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  global: { headers: { Authorization: `Bearer ${supabaseServiceKey}` } },
  auth: { persistSession: false }
});

const perplexityApiKey = Deno.env.get('PERPLEXITY_API_TOKEN') || '';
if (!perplexityApiKey) {
  console.error('Missing PERPLEXITY_API_TOKEN for Deep Research Agent');
}

// Import type declarations for Deno
type DenoReadableStream<T> = ReadableStream<T>;
const encoder = new TextEncoder();


// --- Main Handler for Deep Research ---
async function handleDeepResearchQuery(
  query: string,
  // deno-lint-ignore no-explicit-any
  messages: any[], // Adjust type based on Perplexity's message format
  documentContext = ''
): Promise<DenoReadableStream<Uint8Array>> {
  console.log('--- handleDeepResearchQuery called ---');
  const model = "sonar-reasoning-pro"; // Use reasoning model
  console.log(`Selected model: ${model}`);
  
  const perplexityMessages = messages.map(msg => ({
    role: msg.role === 'system' ? 'system' : (msg.role === 'user' ? 'user' : 'assistant'),
    content: msg.content
  }));
  
  // Add the current user query to the messages array for Perplexity
  if (!perplexityMessages.find(m => m.role === 'user' && m.content === query)) {
      perplexityMessages.push({ role: 'user', content: query });
  }
  
  let systemPrompt = `You are an expert legal research AI assistant. Your primary task is to provide comprehensive answers to legal queries based on in-depth research.

**Critical Instructions for Citing Sources:**
1. When you use information directly from a web source, you **MUST** cite it immediately in your response.
2. Format the citation as a markdown link: \`[Descriptive Title of Source](URL)\`.
3. Provide this markdown link the *first time* you substantively use information from that specific source or when it's most relevant to the point being made.
4. **Do NOT use numeric citations like [1] or [Source 1]. Use only direct markdown links as described.**
5. If a source has a clear title, use it for the link text. If not, use a concise description of the content or the domain name.
6. Ensure all URLs are fully qualified (e.g., https://www.example.com/page).

**Response Structure and Content:**
- Structure your response clearly using markdown for headings, lists, and emphasis.
- Prioritize accuracy, relevance, and the authoritativeness of your sources.
- If quoting, ensure proper attribution in addition to the markdown link if appropriate.
- If discussing U.S. law, specify federal or state applicability.
- If the query implies a specific jurisdiction, focus your research accordingly.
- When you use information *specifically from the document context provided by the user*, clearly state this by saying, for example, "According to the provided context..." or "Based on the document context you provided...". If you are also using an external source for the same point, cite that as well using the markdown link format.

Example of desired citation format:
"The concept of 'fair use' in copyright law allows for limited use of copyrighted material without permission, as discussed in [Stanford University Libraries: Copyright & Fair Use](https://fairuse.stanford.edu/overview/fair-use/what-is-fair-use/)."

Begin your research and present your findings.`;

  if (documentContext) {
    systemPrompt += `

Relevant Document Context (analyze and incorporate if applicable):
${documentContext}`;
  }

  const transformer = new TransformStream();
  const writer = transformer.writable.getWriter();

  (async () => {
    try {
      const requestBody = {
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          ...perplexityMessages
        ],
        stream: true,
        web_search_options: {
          search_context_size: "high" // For more comprehensive search context
        }
        // Perplexity specific options can be added here if needed
        // e.g., search_focus, search_domain_filter, etc.
        // For deep legal research, we might want to guide its search:
        // options: { "search_focus": "scholar", "search_source_filter": ["legal_journals", "case_law_databases"] }, 
        // The above options are examples and need to be validated against Perplexity's actual API.
        // For now, keeping it simple until API docs are confirmed.
      };

      console.log("Sending request to Perplexity:", JSON.stringify(requestBody, null, 2));

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${perplexityApiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Perplexity API error:', response.status, errorText);
        throw new Error(`Perplexity API error (${response.status}): ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Perplexity response body is null');
      }

      // Send metadata event first
      const metadataEvent = {
        type: 'metadata',
        responseType: 'deep_research', // Important for frontend
        model: model, 
        sources: [] // Will populate if Perplexity provides structured sources
      };
      await writer.write(encoder.encode(`data: ${JSON.stringify(metadataEvent)}\n\n`));
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentSources: SourceInfo[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const rawJson = line.substring(5).trim();
              if (rawJson === '[DONE]') { // Perplexity specific stream end might be different
                 console.log('Perplexity stream indicated [DONE]');
                 break; // Or handle completion
              }
              const eventData = JSON.parse(rawJson);
              // console.log("Perplexity event:", JSON.stringify(eventData, null, 2));

              if (eventData.choices && eventData.choices[0].delta?.content) {
                await writer.write(encoder.encode(`data: ${JSON.stringify({ 
                  type: 'answer', 
                  content: eventData.choices[0].delta.content 
                })}\n\n`));
              }
              
              // Activate and refine Perplexity source streaming
              if (eventData.choices && eventData.choices[0].sources && Array.isArray(eventData.choices[0].sources)) {
                 const newSourcesThisEvent: SourceInfo[] = eventData.choices[0].sources.map((s: any) => ({
                    title: s.title || s.name || "Unknown Source", // Prefer title, fallback to name
                    url: s.url || "N/A",
                    snippet: s.snippet || s.text || undefined // Prefer snippet, fallback to text
                 })).filter((s: SourceInfo) => s.url !== "N/A"); // Filter out sources without URLs

                 if (newSourcesThisEvent.length > 0) {
                    console.log('Deep Research Agent - Parsed newSourcesThisEvent:', JSON.stringify(newSourcesThisEvent, null, 2)); // Added logging
                    // Deduplicate sources based on URL before adding to currentSources
                    const uniqueNewSources = newSourcesThisEvent.filter(newSrc => 
                        !currentSources.some(existingSrc => existingSrc.url === newSrc.url)
                    );

                    if (uniqueNewSources.length > 0) {
                        currentSources = [...currentSources, ...uniqueNewSources];
                        // Send updated sources metadata
                        await writer.write(encoder.encode(`data: ${JSON.stringify({
                            type: 'metadata',
                            responseType: 'deep_research',
                            model: model,
                            sources: currentSources // Send cumulative sources
                        })}\n\n`));
                    }
                 }
              }

            } catch (e) {
              console.warn('Failed to parse Perplexity SSE data:', line, e);
            }
          }
        }
      }
      
      // Send final complete event
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'complete' })}\n\n`));

    } catch (error) {
      console.error('Deep research stream processing error:', error);
      await writer.write(encoder.encode(`data: ${JSON.stringify({ 
        type: 'error',
        error: `Error in deep research: ${error.message}` 
      })}\n\n`));
    } finally {
      await writer.close();
    }
  })();

  return transformer.readable;
}


// --- Main Serve Function (adapted from claude-router) ---
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let newConversationId: string | null = null;

  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      console.warn('Missing Authorization header');
      return new Response(JSON.stringify({ error: 'Missing authorization token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      const errorMessage = userError?.message || 'User not found for token';
      console.error('Auth Error:', errorMessage);
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const userId = user.id;
    console.log('User authenticated for Deep Research:', userId);

    const {
      messages,
      caseId,
      conversationId: conversationIdFromRequest,
      documentContextIds,
      // activeDocumentId, // May not be directly used for Perplexity in the same way
      // preloadedContext, // May not be directly used
      query: directQuery,
    }: DeepResearchRequestBody = await req.json();

    console.log(`Deep Research Request: user=${userId}, msgs=${messages?.length || 0}, case=${caseId}, conv=${conversationIdFromRequest}, ctxIds=${documentContextIds?.length || 0}`);

    let queryContent = directQuery || '';
    if (!queryContent && messages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === 'user') {
        queryContent = lastMessage.content;
      }
    }

    if (!queryContent) {
      return new Response(JSON.stringify({ error: 'No query provided for deep research' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let conversationId: string | null = conversationIdFromRequest || null;
    
    // Conversation Management (similar to claude-router)
    if (conversationId) {
      const { data: convData, error: convError } = await supabaseAdmin
        .from('conversations')
        .select('id, owner_id') // Select only necessary fields
        .eq('id', conversationId)
        .maybeSingle();

      if (convError) throw convError;
      if (!convData) conversationId = null; // Conversation not found, will create new if caseId present
      else if (convData.owner_id !== userId) {
        return new Response(JSON.stringify({ error: 'Access denied to conversation' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (!conversationId && caseId) {
      const title = `Deep Research: ${queryContent.substring(0, 40)}...`;
      const { data: createData, error: createError } = await supabaseAdmin
        .from('conversations')
        .insert({ title, case_id: caseId, owner_id: userId })
        .select('id')
        .single();
      if (createError || !createData) throw createError || new Error("Failed to create conversation");
      conversationId = createData.id;
      newConversationId = conversationId;
    }

    // Save user message
    if (conversationId && queryContent) {
      await supabaseAdmin.from('messages').insert({
        id: uuidv4(),
        conversation_id: conversationId,
        role: 'user',
        content: queryContent,
        owner_id: userId,
        metadata: documentContextIds?.length ? { document_context: documentContextIds } : undefined,
      });
    }

    // Document Context Retrieval (similar to claude-router)
    let fetchedContextText = '';
    if (documentContextIds && documentContextIds.length > 0 && caseId) {
      try {
        const { data: docsData, error: docsError } = await supabaseAdmin
          .from('documents')
          .select('filename, extracted_text')
          .in('id', documentContextIds)
          .eq('case_id', caseId); // Ensure documents belong to the case

        if (docsError) throw docsError;
        if (docsData) {
          fetchedContextText = docsData.map(doc => 
            `--- Document: ${doc.filename} ---
${(doc.extracted_text || '').substring(0, 5000)}

`
          ).join('');
        }
      } catch (docError) {
        console.error('Error fetching document context for deep research:', docError);
        fetchedContextText = `
[Error fetching document context]
`;
      }
    }
    
    // Call the Perplexity handler
    const responseStream = await handleDeepResearchQuery(queryContent, messages, fetchedContextText);
    
    const responseHeadersInit: HeadersInit = { 
      ...corsHeaders, 
      'Content-Type': 'text/event-stream', 
      'Cache-Control': 'no-cache'
    };
    if (newConversationId) {
      responseHeadersInit['X-Conversation-Id'] = newConversationId;
    }
    
    return new Response(responseStream, { headers: responseHeadersInit });
    
  } catch (error) {
    console.error('Deep Research Agent error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An unknown error occurred in Deep Research Agent' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}); 