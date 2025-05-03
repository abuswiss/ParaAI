import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { OpenAI } from "npm:openai@^4.0.0";
import Anthropic from "npm:@anthropic-ai/sdk@^0.22.0";
import { Message as VercelChatMessage } from 'npm:ai@^3.1.32'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// --- Configuration ---
const MAX_CONTEXT_TOKENS_APPROX = 8000; // Increased slightly for context
const MAX_TOTAL_TOKENS_APPROX = 16000; // Approx limit for final messages sent to LLM (leaving room for response)
const PPLX_API_URL = 'https://api.perplexity.ai/chat/completions';

// Define types for the expected request body and context
interface ChatRequestBody {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  modelId?: string;
  useWebSearch?: boolean;
  caseId?: string;
  documentContext?: string[]; // Array of document IDs for general context
  analysisContext?: { // Specific item context
    analysisType: string;
    analysisItem: any;
    documentText: string; // Full text of the document the item came from
  } | null;
}

interface SearchResult {
    title: string;
    url: string;
    content?: string; 
}

// Helper to roughly estimate token count (adjust multiplier as needed)
function estimateTokens(text: string | null | undefined): number {
    return Math.ceil((text || '').length / 3.5); 
}

// Helper to format the analysis item for the prompt
function formatAnalysisItem(item: any, type: string): string {
  if (!item) return 'N/A';
  try {
    switch(type) {
      case 'clauses':
        return `Clause Title: ${item.title || 'N/A'}\nClause Text: "${item.text || 'N/A'}"\nAnalysis: ${item.analysis || 'N/A'}`;
      case 'risks':
        return `Risk Title: ${item.title || 'N/A'}\nSeverity: ${item.severity || 'N/A'}\nExplanation: ${item.explanation || 'N/A'}${item.suggestion ? '\nSuggestion: ' + item.suggestion : ''}`;
      case 'entities':
        return `Entity Text: "${item.text || 'N/A'}"\nEntity Type: ${item.type || 'N/A'}`;
      case 'timeline':
         return `Date: ${item.date ? new Date(item.date).toLocaleDateString() : 'N/A'}\nEvent: ${item.event || 'N/A'}${item.type ? '\nType: ' + item.type : ''}`;
      case 'privilegedTerms':
        return `Term: "${item.text || 'N/A'}"\nCategory: ${item.category || 'N/A'}\nReason: ${item.explanation || 'N/A'}`;
      case 'summary': // Handle the summary/analysis object
         return `Summary Focus: ${item.summaryAnalysis || 'Overall Summary Provided'}`;
      default:
        // Attempt generic formatting
        if (typeof item === 'string') return item;
        return JSON.stringify(item, null, 2).substring(0, 500); // Truncate complex objects
    }
  } catch (e) {
      console.error(`Error formatting analysis item type ${type}:`, e);
      return 'Error formatting item.';
  }
}

console.log('Generic Chat Agent function initializing...')

// Initialize Supabase client 
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    // Optionally throw an error to prevent the function from starting
}

const supabaseAdmin: SupabaseClient = createClient(supabaseUrl!, supabaseServiceKey!, {
    global: { headers: { Authorization: `Bearer ${supabaseServiceKey!}` } },
    auth: { persistSession: false } // Important for server-side
});

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
        messages, 
        modelId = 'openai-gpt-4o', 
        useWebSearch = false, 
        caseId, 
        documentContext, // General doc IDs
        analysisContext // Specific item context
    }: ChatRequestBody = await req.json()

    console.log(`Request: model=${modelId}, webSearch=${useWebSearch}, msgs=${messages.length}, case=${caseId}, generalCtx=${documentContext?.length}, specificCtx=${!!analysisContext}`);

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
        return new Response(JSON.stringify({ error: 'Invalid last message. Expected user message.' }), { 
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }

    // --- Specific Analysis Context --- 
    let specificContextText = '';
    if (analysisContext) {
        console.log(`Processing specific analysis context: Type=${analysisContext.analysisType}`);
        const formattedItem = formatAnalysisItem(analysisContext.analysisItem, analysisContext.analysisType);
        // Include the full document text provided in the context
        // Truncate the doc text if it's extremely long, prioritizing item details
        const maxDocTextChars = 15000;
        const contextDocText = analysisContext.documentText.length > maxDocTextChars 
            ? analysisContext.documentText.substring(0, maxDocTextChars) + '\n... [Document Text Truncated] ...'
            : analysisContext.documentText;
            
        specificContextText = `

Relevant Context for this Query:
---------------------------------
Analysis Type: ${analysisContext.analysisType}
Specific Item Details:
${formattedItem}

Full Document Text Where Item Appears:
---
${contextDocText}
---
---------------------------------

`;
    }

    // --- Web Search --- 
    let searchResultsText = '';
    if (useWebSearch) {
        console.log(`Performing web search for query: "${lastMessage.content}"`);
        try {
            // Assuming perplexity-search function exists and returns { results: SearchResult[] }
            const { data: searchData, error: searchError } = await supabaseAdmin.functions.invoke('perplexity-search', {
                body: { query: lastMessage.content },
            });

            if (searchError) throw new Error(`Perplexity search function failed: ${searchError.message}`);
            // Adjust based on actual return structure of perplexity-search
            const results = searchData?.results as SearchResult[] | undefined;
            if (!results || !Array.isArray(results)) throw new Error('Invalid response structure from perplexity-search function.');
            
            if (results.length > 0) {
                searchResultsText = "\n\nWeb Search Results:\n" + results.slice(0, 5).map((r, i) => // Limit to top 5 results
                    `${i+1}. ${r.title}\n   URL: ${r.url}\n   Snippet: ${r.content || 'N/A'}`
                ).join('\n\n');
                console.log(`Search successful, ${results.length} results found.`);
            } else {
                 console.log("No web search results found.");
                 searchResultsText = "\n\n[No relevant web search results found]"
            }

        } catch (searchError) {
            console.error('Web search failed:', searchError);
            searchResultsText = "\n\n[Web search failed]" 
        }
    }

    // --- General Document Context Fetching ---
    let generalDocumentContextText = '';
    let fetchedDocCount = 0;
    let totalDocTokens = 0;
    const maxDocTokens = MAX_CONTEXT_TOKENS_APPROX * 0.7;
    // Only fetch general docs if specific context didn't provide its own doc text
    if (documentContext && documentContext.length > 0 && !analysisContext?.documentText) {
        console.log(`Fetching context for ${documentContext.length} document(s)...`);
        let tempContext = '\n\nDocument Context:\n';
        try {
            const { data: docsData, error: docsError } = await supabaseAdmin
                .from('documents')
                .select('id, filename, extracted_text')
                .in('id', documentContext)
                .eq('case_id', caseId) // Ensure docs belong to the case
                .neq('processing_status', 'uploaded') // Ensure text extraction happened
                .neq('processing_status', 'text_extraction_pending')
                .neq('processing_status', 'text_extraction_failed')

            if (docsError) throw docsError;

            if (docsData && docsData.length > 0) {
                for (const doc of docsData) {
                    if (!doc.extracted_text) continue;
                    
                    const docHeader = `--- Document: ${doc.filename} (ID: ${doc.id}) ---\n`;
                    const docText = doc.extracted_text;
                    const docTokens = estimateTokens(docHeader + docText);

                    if (totalDocTokens + docTokens <= maxDocTokens) {
                        tempContext += docHeader + docText + '\n';
                        totalDocTokens += docTokens;
                        fetchedDocCount++;
                    } else {
                         // Try adding just a truncated portion if it fits
                         const remainingTokens = maxDocTokens - totalDocTokens;
                         const charsToKeep = Math.floor(remainingTokens * 3.0); // Rough estimate
                         if (remainingTokens > estimateTokens(docHeader) + 50) { // Only add if meaningful space left
                             tempContext += docHeader + docText.substring(0, charsToKeep) + '... [TRUNCATED]\n';
                             totalDocTokens += estimateTokens(docHeader + docText.substring(0, charsToKeep) + '... [TRUNCATED]');
                             fetchedDocCount++;
                         } 
                         console.warn(`Context token limit (${maxDocTokens}) reached. Stopped adding full text from document ${doc.filename}.`);
                         break; // Stop adding more documents
                    }
                }
                generalDocumentContextText = tempContext + '---\n';
                console.log(`Fetched general context from ${fetchedDocCount} documents, approx ${totalDocTokens} tokens.`);
            } else {
                console.log('No general documents found or accessible.');
                 generalDocumentContextText = "\n\n[Selected general documents not found or text not available]"
            }
        } catch (docError) {
            console.error('Error fetching general document context:', docError);
            generalDocumentContextText = "\n\n[Error fetching general document context]"
        }
    }
    
    // --- System Prompt Construction --- 
    const systemCorePrompt = `You are BenchWise AI, a specialized legal AI assistant...`; // Base prompt
    // Prioritize specific context, then general, then search results
    const contextBlock = specificContextText || generalDocumentContextText || ''; 
    const systemPrefix = `${systemCorePrompt}${contextBlock}${searchResultsText}\n\n`;
    
    const systemPromptTokens = estimateTokens(systemPrefix);
    // Explicitly type finalMessages array
    const finalMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = []; 
    let currentHistoryTokens = 0;
    const maxHistoryTokens = MAX_TOTAL_TOKENS_APPROX - systemPromptTokens - 800; 

    finalMessages.push({ role: 'system', content: systemPrefix });

    // Add history messages
    for(let i = messages.length - 1; i >= 0; i--){
      const msg = messages[i];
      const msgTokens = estimateTokens(msg.content);
      if (currentHistoryTokens + msgTokens <= maxHistoryTokens) {
        finalMessages.splice(1, 0, { role: msg.role, content: msg.content }); // Insert after system msg
        currentHistoryTokens += msgTokens;
      } else {
        console.warn(`Token limit reached adding history. Stopped at message ${i}.`);
        break;
      }
    }
     console.log(`Final Prompt: System tokens=${systemPromptTokens}, History tokens=${currentHistoryTokens}, Total approx=${systemPromptTokens + currentHistoryTokens}`);

    // --- LLM Selection and Non-Streaming Call ---
    let responseContent: string | null = null; // Variable to hold the final content

    // Add appropriate error handling for missing API keys
    const getApiKey = (keyName: string) => {
        const key = Deno.env.get(keyName);
        if (!key) throw new Error(`${keyName} not set`);
        return key;
    };

    try {
        if (modelId.startsWith('claude-')) {
            const anthropic = new Anthropic({ apiKey: getApiKey('ANTHROPIC_API_KEY') });
            const systemPromptMsg = finalMessages.find(m => m.role === 'system')?.content || '';
            // Ensure correct type for Anthropic messages (User/Assistant roles)
            const userAssistantMessages: Anthropic.Messages.MessageParam[] = finalMessages
                .filter((m): m is { role: 'user' | 'assistant'; content: string } => m.role !== 'system')
                .map(m => ({ role: m.role, content: m.content }));
                
            console.log(`Calling Anthropic (${modelId}) non-streaming...`);
            const response = await anthropic.messages.create({
                model: modelId,
                system: systemPromptMsg,
                messages: userAssistantMessages, // Use typed array
                max_tokens: 2048,
            });
            responseContent = response.content?.[0]?.type === 'text' ? response.content[0].text : null;
            if (!responseContent) console.warn("Anthropic response format unexpected or empty:", response);

        } else if (modelId.startsWith('perplexity-')) {
             const perplexityApiKey = getApiKey('PERPLEXITY_API_KEY');
             // Perplexity expects messages without the system prompt in the main array
             let pplxMessages = finalMessages
                .filter(m => m.role !== 'system')
                .map(m => ({ role: m.role, content: m.content }));

             const systemPromptContent = finalMessages.find(m => m.role === 'system')?.content;
 
             console.log(`Calling Perplexity API (${modelId}) non-streaming...`);
             const pplxResponse = await fetch(PPLX_API_URL, {
                 method: 'POST',
                 headers: {
                     'Authorization': `Bearer ${perplexityApiKey}`,
                     'Content-Type': 'application/json',
                     // 'Accept': 'text/event-stream' // Remove Accept for SSE
                 },
                 body: JSON.stringify({
                     model: modelId,
                     messages: pplxMessages, // Use filtered/mapped array
                     ...(systemPromptContent && { system_prompt: systemPromptContent }),
                 }),
             });

             if (!pplxResponse.ok) {
                 const errorBody = await pplxResponse.text();
                 console.error(`Perplexity API Error (${pplxResponse.status}): ${errorBody}`);
                 throw new Error(`Perplexity API request failed: ${pplxResponse.status} ${errorBody}`);
             }

             const responseJson = await pplxResponse.json();
             // Extract content - Check Perplexity API docs for exact structure
             responseContent = responseJson.choices?.[0]?.message?.content;
              if (!responseContent) console.warn("Perplexity response format unexpected or empty:", responseJson);

        } else {
            // Default to OpenAI
            const openai = new OpenAI({ apiKey: getApiKey('OPENAI_API_KEY') });
            const actualModelId = modelId === 'default-chat' ? 'gpt-4o-mini' : modelId;
            // Ensure correct type for OpenAI messages
            const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = finalMessages.map(m => ({ 
                role: m.role as 'system' | 'user' | 'assistant', // Cast role
                content: m.content 
            }));

            console.log(`Calling OpenAI (${actualModelId}) non-streaming...`);
            const response = await openai.chat.completions.create({
                model: actualModelId,
                messages: openAiMessages, // Use typed array
                temperature: 0.7,
            });
            responseContent = response.choices[0]?.message?.content;
             if (!responseContent) console.warn("OpenAI response format unexpected or empty:", response);
        }
    } catch (llmError) {
        console.error(`LLM API Error (${modelId}):`, llmError);
        throw new Error(`Failed to get response from ${modelId}: ${llmError.message}`);
    }

    // --- Return Full Response ---
    if (responseContent === null) {
        console.error("LLM response content was null or could not be extracted.");
        // Fallback response or throw error
        responseContent = "[Error: Could not retrieve response from AI model]";
    }

    console.log("Returning full response content.");
    return new Response(JSON.stringify({ content: responseContent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in generic-chat-agent (non-streaming):', error)
    const errorMessage = error instanceof Error ? error.message : 'An internal server error occurred.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

console.log('Generic Chat Agent function ready (non-streaming mode).') 