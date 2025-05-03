// supabase/functions/analyze-document/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'; // Use SupabaseClient type
import { OpenAI } from 'https://deno.land/x/openai@v4.52.7/mod.ts'; // Use specific version or ensure compatibility

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

console.log('Function analyze-document initializing...');

// --- Helper: Create OpenAI Client ---
function createOpenAIClient(): OpenAI {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    console.error('Missing environment variable: OPENAI_API_KEY');
    throw new Error('Server configuration error: Missing OpenAI API Key.');
  }
  return new OpenAI({ apiKey });
}

// --- Helper: Create Supabase Admin Client (SERVICE_ROLE) ---
function createSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    throw new Error('Server configuration error: Missing Supabase credentials.');
  }
  // Correctly call createClient with options object
  return createClient(supabaseUrl!, supabaseServiceKey!, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    }
  });
}


// --- Helper: Get Prompt based on Analysis Type ---
// Define expected structure for response format
interface ResponseFormat {
    type: "json_object" | "text"; // Extend if needed
}

function getPrompts(analysisType: string, text: string, customPrompt?: string): { systemPrompt: string; userPrompt: string; responseFormat?: ResponseFormat } {
  console.log(`[analyze-document] getPrompts called with type: ${analysisType}`);

  // Limit document size (e.g., ~100k tokens for gpt-4o context, but keep lower for performance/cost)
  // Let's aim for roughly 20k characters as a practical limit (~5k tokens)
  const MAX_CHARS = 20000;
  const truncatedText = text.length > MAX_CHARS ? text.substring(0, MAX_CHARS) + `

[Document truncated to ${MAX_CHARS} characters for analysis]` : text;
  console.log(`[analyze-document] Text length: ${text.length}, using ${truncatedText.length} chars`);

  let systemPrompt = '';
  let userPrompt = '';
  let responseFormat: ResponseFormat | undefined = undefined; // Default to text

  switch(analysisType){
    case 'summary':
      // REVISED for separate summary and analysis
      systemPrompt = `You are an expert legal assistant. Your task is to first create a concise, factual summary of the provided legal document text, and then provide a brief, high-level legal analysis of that summary, identifying potential implications or key areas of legal significance mentioned in the summary.

Respond ONLY with a valid JSON object containing two keys:
1. "summary": A string containing the concise, factual summary.
2. "summaryAnalysis": A string containing the brief, high-level legal analysis of the summary.

Focus only on the provided text.`;
      userPrompt = `Generate a summary and a legal analysis of that summary for the following document text, adhering strictly to the JSON format specified in the system prompt.

Document Text:
---
${truncatedText}
---`;
      responseFormat = { type: "json_object" }; // Expect JSON now
      break;

    case 'entities':
      // REFINED PROMPT for Entities (with emphasized accuracy)
      systemPrompt = `You are an expert legal entity extraction system.
Your task is to identify and categorize key entities within legal documents.
Focus on entities relevant to legal context and obligations.

Categories:
- PERSON: Individuals' full names (e.g., "Jane Doe"). Avoid pronouns.
- ORGANIZATION: Companies, law firms, government bodies, institutions (e.g., "Acme Corp", "DOJ").
- LOCATION: Cities, states, countries, specific addresses mentioned in a legal context (e.g., "New York County", "123 Main St").
- DATE: Specific dates, date ranges, or time references critical to the document (e.g., "January 1, 2024", "Effective Date", "Term").
- AGREEMENT_NAME: Official titles of contracts or agreements referenced (e.g., "Master Services Agreement", "Non-Disclosure Agreement").
- COURT: Specific courts or judicial bodies mentioned (e.g., "Supreme Court of California", "Ninth Circuit Court of Appeals").
- STATUTE_CITATION: References to laws, codes, or regulations (e.g., "U.C.C. § 2-207", "15 U.S.C. § 78u-4", "California Civil Code Section 1542").
- CASE_CITATION: References to specific court cases (e.g., "Marbury v. Madison, 5 U.S. 137 (1803)").
- MONETARY_VALUE: Specific currency amounts relevant to obligations or penalties (e.g., "$10,000 USD", "€50,000").
- LEGAL_TERM: Significant legal terms, doctrines, or defined terms within the document (e.g., "Force Majeure", "Indemnification", "Governing Law", "Confidential Information").

Output Format:
Respond ONLY with a valid JSON object containing a single key "entities".
The value of "entities" must be an array of objects.
Each object in the array **must** have the following keys:
- "text": The exact extracted entity string from the document.
- "type": One of the exact category names listed above (e.g., PERSON, ORGANIZATION, etc.).
- "start": The 0-based starting character index of the entity in the original text.
- "end": The 0-based ending character index (exclusive) of the entity in the original text.

If no relevant entities are found, return {"entities": []}.`;
      userPrompt = `Extract entities from the following document text precisely according to the system prompt instructions. Ensure the start and end indices **accurately** reflect the entity's position in the provided text. Focus on legally relevant entities and use the specified categories and JSON format strictly. Document Text:
---
${truncatedText}
---`;
      responseFormat = { type: "json_object" };
      break;

    case 'clauses':
      // REFINED PROMPT for Clauses (with added start/end and emphasized accuracy)
      systemPrompt = `You are an expert legal clause identification system. Your task is to identify and analyze important legal clauses in contracts and agreements. Focus on clauses with significant legal implications (e.g., obligations, restrictions, liabilities, definitions).

Respond ONLY with a valid JSON object containing a single key "clauses".
The value of "clauses" must be an array of objects.
Each object represents a clause and **must** have the following keys:
- "title": A concise, descriptive title for the clause (e.g., "Confidentiality Obligation", "Governing Law", "Limitation of Liability").
- "text": The exact, complete text of the identified clause from the document.
- "analysis": A brief (1-2 sentence) analysis of the clause's purpose or key implication in the context of the document.
- "start": The 0-based starting character index of the clause in the original text.
- "end": The 0-based ending character index (exclusive) of the clause in the original text.

If no significant clauses are found, return {"clauses": []}.`;
      userPrompt = `Extract and analyze important legal clauses from the following document text, ensuring **accuracy** of text, analysis, and **start/end indices**. Use the specified categories and JSON format strictly. Document Text:
---
${truncatedText}
---`;
      responseFormat = { type: "json_object" };
      break;

    case 'risks':
      // REFINED PROMPT for Risks (with emphasized accuracy)
      systemPrompt = `You are an expert legal risk analysis system. Your task is to identify potential legal risks, ambiguities, or unfavorable terms for a hypothetical client reviewing this document.

Respond ONLY with a valid JSON object containing a single key "risks".
The value of "risks" must be an array of objects.
Each object represents a potential risk and **must** have the following keys:
- "title": A concise title summarizing the risk (e.g., "Broad Indemnification Clause", "Ambiguous Payment Terms", "Unilateral Termination Right").
- "severity": The potential severity, categorized as "Low", "Medium", "High", or "Critical".
- "explanation": A clear explanation of the risk and why it might be concerning.
- "suggestion": (Optional) A brief suggestion for mitigation or clarification, if applicable.
- "start": The 0-based starting character index of the *most relevant passage* in the original text.
- "end": The 0-based ending character index (exclusive) of the *most relevant passage* in the original text.
(If a risk applies generally or isn't tied to specific text, use the start/end indices of the most relevant sentence or paragraph, or use start=0, end=0 as a last resort if no text is relevant).

If no significant risks are identified, return {"risks": []}.`;
      userPrompt = `Analyze this document for potential legal risks from the perspective of a party reviewing it. Provide severity, explanation, suggestion (optional), and **accurate** start/end indices for the relevant text passage where applicable. Use the specified categories and JSON format strictly. If no risks are found, return an empty array. Document Text:
---
${truncatedText}
---`;
      responseFormat = { type: "json_object" };
      break;

    case 'timeline':
      // REFINED PROMPT for Timeline (with added start/end and emphasized accuracy)
      systemPrompt = `You are an expert legal timeline extraction system. Identify key events, dates, deadlines, and durations mentioned in the legal document.

Respond ONLY with a valid JSON object containing a single key "timeline".
The value of "timeline" must be an array of objects, sorted chronologically if possible.
Each object represents a timeline event and **must** have the following keys:
- "date": The specific date or time reference (use ISO 8601 format YYYY-MM-DD if possible, otherwise use the descriptive text like "Effective Date", "Closing Date", "within 30 days").
- "event": A concise description of the event occurring on or by that date.
- "type": (Optional) A category for the event (e.g., "Commencement", "Deadline", "Milestone", "Termination Condition").
- "start": The 0-based starting character index of the text passage describing the event/date in the original text.
- "end": The 0-based ending character index (exclusive) of the text passage in the original text.

If no timeline events are found, return {"timeline": []}.`;
      userPrompt = `Extract a chronological timeline of key events, dates, deadlines, and durations from the following document text. Provide type (optional) and **accurate** start/end character indices for each event. Use the specified categories and JSON format strictly. Document Text:
---
${truncatedText}
---`;
      responseFormat = { type: "json_object" };
      break;

    case 'privilegedTerms':
      // REFINED PROMPT for Privileged Terms (with emphasized accuracy)
      systemPrompt = `You are an expert legal privilege identification system. Your task is to identify text segments within the document that *might* be subject to legal privilege or confidentiality protection (e.g., attorney-client communication, work product, trade secrets, confidential settlement details). Flag potentially sensitive terms or phrases.

Respond ONLY with a valid JSON object containing a single key "privilegedTerms".
The value of "privilegedTerms" must be an array of objects.
Each object represents a potentially privileged segment and **must** have the following keys:
- "text": The exact text segment identified.
- "category": A suggested category (e.g., "ATTORNEY_CLIENT", "WORK_PRODUCT", "CONFIDENTIAL_BUSINESS_INFO", "SETTLEMENT_DETAIL", "TRADE_SECRET").
- "explanation": A brief (1 sentence) explanation of why this segment might be considered privileged or confidential in context.
- "start": The 0-based starting character index of the segment in the original text.
- "end": The 0-based ending character index (exclusive) of the segment in the original text.

Focus on flagging, not definitively determining privilege. If no potential terms are found, return {"privilegedTerms": []}.`;
      userPrompt = `Identify potentially privileged or confidential text segments in the following document. Provide the suggested category, a brief explanation, and **accurate** start/end character indices for each segment. Use the specified categories and JSON format strictly. Document Text:
---
${truncatedText}
---`;
      responseFormat = { type: "json_object" };
      break;

    case 'custom':
    default:
      systemPrompt = 'You are a helpful legal document analysis assistant.';
      // For custom, we don't enforce JSON unless the prompt asks for it.
      userPrompt = customPrompt ? `${customPrompt}

Document Text:
---
${truncatedText}
---` : `Please provide a general analysis of the following document:
---
${truncatedText}
---`;
      console.warn(`[analyze-document] Using default/custom prompt for type: ${analysisType}`);
      break;
  }
  return { systemPrompt, userPrompt, responseFormat };
}

console.log('--- analyze-document: Defined helpers ---');

// --- Main Function Handler ---
serve(async (req: Request) => {
  const requestStartTime = Date.now();
  console.log(`[${requestStartTime}] --- analyze-document: Request received ---`);

  // 0. Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log(`[${requestStartTime}] Handling OPTIONS request`);
    return new Response('ok', { headers: corsHeaders });
  }

  // Ensure it's a POST request
  if (req.method !== 'POST') {
    console.warn(`[${requestStartTime}] Received non-POST request: ${req.method}`);
    return new Response(JSON.stringify({ success: false, error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  console.log(`[${requestStartTime}] Handling POST request`);
  try {
    // 1. Parse request body
    let body: any; // Use 'any' for now, consider defining an interface
    try {
      body = await req.json();
      const textLength = body.documentText ? body.documentText.length : 'undefined';
      console.log(`[${requestStartTime}] Request body parsed. Type: ${body.analysisType}, Doc ID: ${body.documentId}, Text Length: ${textLength}`);
    } catch (error) {
      console.error(`[${requestStartTime}] Failed to parse request body:`, error);
      return new Response(JSON.stringify({ success: false, error: `Invalid request body: ${error.message}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Extract parameters & Validate
    const { documentId, analysisType = 'summary', customPrompt, documentText, userId } = body;

    if (!documentText || typeof documentText !== 'string' || documentText.trim().length === 0) {
      console.error(`[${requestStartTime}] Invalid or missing documentText parameter`);
      return new Response(JSON.stringify({ success: false, error: 'Missing or empty required parameter: documentText' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (!analysisType || typeof analysisType !== 'string') {
      console.error(`[${requestStartTime}] Invalid or missing analysisType parameter`);
      return new Response(JSON.stringify({ success: false, error: 'Missing or invalid required parameter: analysisType' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Initialize clients
    console.log(`[${requestStartTime}] Initializing clients...`);
    const supabaseAdmin = createSupabaseAdminClient();
    const openai = createOpenAIClient();
    console.log(`[${requestStartTime}] Clients initialized successfully.`);

    // 4. Get Prompts
    const { systemPrompt, userPrompt, responseFormat } = getPrompts(analysisType, documentText, customPrompt);

    if (!systemPrompt || !userPrompt) {
      console.error(`[${requestStartTime}] Failed to generate prompts for type: ${analysisType}`);
      return new Response(JSON.stringify({ success: false, error: `Invalid analysis type: ${analysisType}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 5. Perform analysis with OpenAI
    const model = "gpt-4o"; // Or consider gpt-4-turbo for balance
    console.log(`[${requestStartTime}] Performing ${analysisType} analysis using ${model}...`);
    const openaiStartTime = Date.now();
    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: model,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        ...(responseFormat && { response_format: responseFormat }) // Apply response format if specified
      });
      const openaiEndTime = Date.now();
      console.log(`[${requestStartTime}] OpenAI API call successful (${openaiEndTime - openaiStartTime}ms). Tokens: ${completion.usage?.total_tokens}`);
    } catch (error) {
      const openaiEndTime = Date.now();
      console.error(`[${requestStartTime}] OpenAI API error (${openaiEndTime - openaiStartTime}ms):`, error);
      // Try to extract a more specific error message if available
      const detail = (error as any)?.response?.data?.error?.message || (error as Error).message || 'Unknown API error';
      return new Response(JSON.stringify({ success: false, error: `OpenAI API Error: ${detail}` }), {
        status: 502, // Bad Gateway for upstream errors
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!completion?.choices?.[0]?.message?.content) {
      console.error(`[${requestStartTime}] Invalid or empty completion response from OpenAI:`, completion);
      return new Response(JSON.stringify({ success: false, error: 'Invalid or empty response from AI model' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const resultText = completion.choices[0].message.content;
    console.log(`[${requestStartTime}] Analysis complete. Raw result length: ${resultText.length} chars.`);

    // 6. Parse result (if JSON was requested)
    let finalResult: any = resultText; // Default to raw text
    let parseError: Error | null = null; // Explicitly type parseError

    if (responseFormat?.type === "json_object") {
      try {
        finalResult = JSON.parse(resultText);
        console.log(`[${requestStartTime}] JSON result parsed successfully.`);
      } catch (error) {
        console.error(`[${requestStartTime}] Failed to parse expected JSON result:`, error);
        console.error(`[${requestStartTime}] Raw non-JSON result from LLM: ${resultText.substring(0, 500)}...`);
        const errorMessage = error instanceof Error ? error.message : String(error);
        finalResult = {
          error: `AI model did not return valid JSON as requested. Parse Error: ${errorMessage}`,
          rawResponse: resultText
        };
        parseError = error instanceof Error ? error : new Error(String(error)); // Assign error object
      }
    }

    // 7. Store in DB (if documentId provided)
    let analysisRecordId = null;
    if (documentId) {
      try {
        const analysisToStore = {
          document_id: documentId,
          user_id: userId || null,
          analysis_type: analysisType,
          result: finalResult, // Store the parsed JSON or raw text/error object
          custom_prompt: customPrompt || null,
          model_used: model,
          prompt_tokens: completion.usage?.prompt_tokens,
          completion_tokens: completion.usage?.completion_tokens,
          total_tokens: completion.usage?.total_tokens,
          parse_error: parseError ? parseError.message : null,
        };

        console.log(`[${requestStartTime}] Storing analysis in DB for doc: ${documentId}`);
        const dbStartTime = Date.now();
        const { data: insertedData, error: dbError } = await supabaseAdmin
          .from('document_analyses')
          .insert(analysisToStore)
          .select('id') // Only select the ID
          .single();
        const dbEndTime = Date.now();

        if (dbError) {
          console.error(`[${requestStartTime}] DB storage error (${dbEndTime - dbStartTime}ms):`, dbError);
          // Log but don't fail the request
        } else if (insertedData) {
          analysisRecordId = insertedData.id;
          console.log(`[${requestStartTime}] Analysis stored in DB (${dbEndTime - dbStartTime}ms) with ID: ${analysisRecordId}`);
        } else {
          console.warn(`[${requestStartTime}] DB insert successful but no ID returned.`);
        }
      } catch (dbCatchError) {
        console.error(`[${requestStartTime}] Unexpected DB operation error:`, dbCatchError);
        // Log but don't fail the request
      }
    } else {
      console.log(`[${requestStartTime}] No documentId provided, skipping DB storage.`);
    }

    // 8. Return success response
    const requestEndTime = Date.now();
    console.log(`[${requestStartTime}] Returning success response (${requestEndTime - requestStartTime}ms total).`);
    return new Response(JSON.stringify({
      success: true,
      analysisId: analysisRecordId,
      result: finalResult
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    // Catch-all for unexpected errors (e.g., client init, param validation)
    const requestEndTime = Date.now();
    console.error(`[${requestStartTime}] Unhandled error in handler (${requestEndTime - requestStartTime}ms):`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

console.log('--- analyze-document: Handler registered ---');