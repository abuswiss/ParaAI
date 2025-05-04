// supabase/functions/analyze-document/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'; // Use SupabaseClient type
import { OpenAI } from 'https://deno.land/x/openai@v4.52.7/mod.ts'; // Use specific version or ensure compatibility
import { distance } from 'https://deno.land/x/fastest_levenshtein/mod.ts'; // Import for fuzzy matching
// Define type for OpenAI API response usage
// import type { ChatCompletion } from 'https://deno.land/x/openai@v4.52.7/resources/chat/completions.ts'; // Removed unused import

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

If no relevant entities are found, return {"entities": []}.`;
      userPrompt = `Extract entities from the following document text precisely according to the system prompt instructions. Focus on legally relevant entities and use the specified categories and JSON format strictly. Document Text:
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

If no significant clauses are found, return {"clauses": []}.`;
      userPrompt = `Extract and analyze important legal clauses from the following document text, ensuring **accuracy** of text and analysis. Use the specified categories and JSON format strictly. Document Text:
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
- "text": The *most relevant passage* from the original text related to this risk. (If a risk applies generally, this might be the most representative sentence or phrase, or even null if truly general).

If no significant risks are identified, return {"risks": []}.`;
      userPrompt = `Analyze this document for potential legal risks from the perspective of a party reviewing it. Provide title, severity, explanation, suggestion (optional), and the most relevant text passage where applicable. Use the specified categories and JSON format strictly. If no risks are found, return an empty array. Document Text:
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
- "text": The text passage from the original document describing the event/date.

If no timeline events are found, return {"timeline": []}.`;
      userPrompt = `Extract a chronological timeline of key events, dates, deadlines, and durations from the following document text. Provide date, event, type (optional), and the source text passage for each event. Use the specified categories and JSON format strictly. Document Text:
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

Focus on flagging, not definitively determining privilege. If no potential terms are found, return {"privilegedTerms": []}.`;
      userPrompt = `Identify potentially privileged or confidential text segments in the following document. Provide the text, suggested category, and a brief explanation for each segment. Use the specified categories and JSON format strictly. Document Text:
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

// ---------> ADD IMPROVED UTILITIES <---------
interface Position {
    start: number;
    end: number;
}

/**
 * Normalizes text for comparison by removing extra whitespace and standardizing characters
 */
function normalizeText(text: string): string {
    if (!text) return '';
    return text.trim()
        .replace(/\s+/g, ' ')         // Normalize whitespace
        .replace(/[\u2018\u2019]/g, "'") // Smart quotes to regular quotes
        .replace(/[\u201C\u201D]/g, '"'); // Smart double quotes to regular quotes
}

/**
 * Calculates similarity with improved handling for different text characteristics
 */
function calculateSimilarity(str1: string, str2: string): number {
    // Normalize and prepare strings
    const s1 = normalizeText(str1).toLowerCase();
    const s2 = normalizeText(str2).toLowerCase();
    
    if (!s1 || !s2) return 0;
    
    // For very short strings, use exact matching
    if (s1.length < 5 || s2.length < 5) {
        return s1 === s2 ? 1 : 0;
    }
    
    // Optimize for performance with very long strings
    if (s1.length > 500 || s2.length > 500) {
        // Compare initial and final portions for long strings
        const prefixLen = Math.min(100, Math.floor(Math.min(s1.length, s2.length) * 0.2));
        const prefix1 = s1.substring(0, prefixLen);
        const prefix2 = s2.substring(0, prefixLen);
        
        const suffixLen = Math.min(100, Math.floor(Math.min(s1.length, s2.length) * 0.2));
        const suffix1 = s1.substring(s1.length - suffixLen);
        const suffix2 = s2.substring(s2.length - suffixLen);
        
        // Calculate similarity for prefix and suffix using Deno's levenshtein distance
        const prefixSim = 1 - (distance(prefix1, prefix2) / Math.max(prefix1.length, prefix2.length));
        const suffixSim = 1 - (distance(suffix1, suffix2) / Math.max(suffix1.length, suffix2.length));
        
        // Average the two scores
        return (prefixSim + suffixSim) / 2;
    }
    
    // Standard Levenshtein for medium-length strings
    const lev = distance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    return maxLength > 0 ? 1 - (lev / maxLength) : 1;
}

/**
 * Extracts meaningful keywords from a string
 */
function extractKeywords(text: string): string[] {
    if (!text || text.length < 4) return [text];
    
    // Remove common stopwords
    const stopwords = ['the', 'and', 'or', 'in', 'on', 'at', 'to', 'a', 'an', 'for', 'with', 'by', 'of', 'is', 'it', 'this', 'that']; // Added more stopwords
    const words = text.split(/\s+/).filter(w => w.length > 3 && !stopwords.includes(w));
    
    // If no good words, use the longest available ones
    if (words.length === 0) {
        const allWords = text.split(/\s+/).filter(w => w.length > 0);
        allWords.sort((a, b) => b.length - a.length);
        return allWords.slice(0, 3);
    }
    
    // Return most distinctive words (longer is usually better)
    words.sort((a, b) => b.length - a.length);
    return words.slice(0, Math.min(5, words.length));
}

/**
 * Optimized function to find best substring match
 */
function findBestSubstring(text: string, query: string): { score: number; offset: number; length: number } {
    let bestScore = 0;
    let bestOffset = 0;
    let bestLength = 0;
    
    // Normalize once
    const queryNorm = normalizeText(query).toLowerCase();
    const textNorm = normalizeText(text).toLowerCase(); // Normalize text being searched in as well
    
    if (!queryNorm || !textNorm) {
        return { score: 0, offset: 0, length: 0 };
    }
    
    // Define adaptive search parameters
    const queryLen = queryNorm.length;
    const minSearchLen = Math.max(3, Math.floor(queryLen * 0.6));
    const maxSearchLen = Math.min(textNorm.length, Math.ceil(queryLen * 1.5)); 
    const stepSize = textNorm.length > 10000 ? Math.max(1, Math.floor(minSearchLen / 2)) : 1;
    
    // Use searchLimit in the loop condition
    const searchLimit = textNorm.length; 
    
    // First try to find a quick match with key words
    const keywords = extractKeywords(queryNorm);
    let keywordMatchAttempted = false;
    if (keywords.length > 0) {
        keywordMatchAttempted = true;
        // Find potential match regions by checking for keywords
        const potentialRegions: { start: number; end: number }[] = []; // Explicit type
        for (const keyword of keywords) {
            let keyPos = 0;
            while ((keyPos = textNorm.indexOf(keyword, keyPos)) !== -1) {
                // Find region in the *original* text based on normalized position
                // This mapping back can be complex; simplify for now: use normalized indices
                const start = Math.max(0, keyPos - queryLen);
                const end = Math.min(textNorm.length, keyPos + keyword.length + queryLen); // Adjusted end calculation
                potentialRegions.push({ start, end });
                keyPos += keyword.length;
            }
        }
        
        // Check each potential region (use original text for candidate extraction)
        for (const region of potentialRegions) {
            // Ensure indices are within bounds of original text
            const boundedStart = Math.min(region.start, text.length - 1);
            const boundedEnd = Math.min(region.end, text.length);

            for (let i = boundedStart; i <= boundedEnd - minSearchLen; i += stepSize) {
                for (let j = i + minSearchLen; j <= Math.min(i + maxSearchLen, boundedEnd); j++) {
                    const candidate = text.substring(i, j); // Use original text here
                    const similarity = calculateSimilarity(candidate, query); // Compare original candidate with original query
                    
                    if (similarity > bestScore) {
                        bestScore = similarity;
                        bestOffset = i;
                        bestLength = j - i;
                        
                        // Early termination for excellent matches
                        if (similarity > 0.95) break;
                    }
                }
                if (bestScore > 0.95) break;
            }
             if (bestScore > 0.95) break; // Break outer loop too
        }
    }
    
    // If no good match found with keywords OR keyword search wasn't applicable, do traditional search
    if (bestScore < 0.7 || !keywordMatchAttempted) {
        console.log(`[FUNC] findBestSubstring: Falling back to traditional search (score: ${bestScore.toFixed(3)})`);
        // Use searchLimit in the loop condition
        for (let i = 0; i <= searchLimit - minSearchLen; i += stepSize) {
            // Dynamic adjustment of max length based on position
            const maxLen = Math.min(maxSearchLen, textNorm.length - i);
            
            for (let j = i + minSearchLen; j <= i + maxLen; j += stepSize) { // Use step here too?
                const candidate = text.substring(i, j); // Use original text
                const similarity = calculateSimilarity(candidate, query);
                
                if (similarity > bestScore) {
                    bestScore = similarity;
                    bestOffset = i;
                    bestLength = j - i;
                    if (bestScore > 0.95) break; // Early exit
                }
            }
            if (bestScore > 0.95) break;
        }
    }
    
    return { score: bestScore, offset: bestOffset, length: bestLength };
}


/**
 * IMPROVED: Finds position with adaptive thresholds and optimized search
 */
function findTextPositionWithFuzzy(
    document: string, 
    searchText: string
): Position | null {
    if (!document || !searchText) return null;
    
    const trimmedSearchText = normalizeText(searchText); // Normalize search text once
    if (!trimmedSearchText) return null;
    
    // Adapt threshold based on text length and content
    const baseThreshold = 0.70; // More permissive base threshold
    const lengthFactor = Math.min(0.15, (trimmedSearchText.length / 100) * 0.05);
    const threshold = Math.min(0.95, baseThreshold + lengthFactor);
    
    // Find best substring match using the optimized function
    const bestMatch = findBestSubstring(document, trimmedSearchText);
    
    // Log match quality
    console.log(`[FUNC] Best fuzzy match for "${trimmedSearchText.substring(0, 20)}...": score=${bestMatch.score.toFixed(3)} (threshold=${threshold.toFixed(3)})`);
    
    // Return position if score meets threshold
    return bestMatch.score >= threshold
        ? { start: bestMatch.offset, end: bestMatch.offset + bestMatch.length }
        : null;
}

/**
 * Main entry point - finds position for text with multiple strategies
 */
function findAccuratePosition(
    originalText: string,
    searchText: string
): Position | null {
    if (!originalText || !searchText) {
        console.warn('[FUNC] findAccuratePosition received invalid input', { 
            textLength: originalText?.length || 0, 
            searchTextLength: searchText?.length || 0
        });
        return null;
    }
    
    // Try exact match first (fastest) - Use original text for exact match
    const exactMatch = originalText.indexOf(searchText);
    if (exactMatch !== -1) {
        // Use const for nextMatchPos as it's not reassigned here
        const nextMatchPos = originalText.indexOf(searchText, exactMatch + 1);
        if (nextMatchPos === -1) {
             console.log(`[FUNC] Found unique exact string match for: "${searchText.substring(0, 30)}..."`);
             return { start: exactMatch, end: exactMatch + searchText.length };
        } else {
             console.warn(`[FUNC] Found multiple exact string matches for: "${searchText.substring(0, 30)}...". Defaulting to first.`);
             return { start: exactMatch, end: exactMatch + searchText.length };
        }
    }
    
    // Try normalized exact match
    const docNorm = normalizeText(originalText).toLowerCase();
    const searchNorm = normalizeText(searchText).toLowerCase();
    const normalizedExactPos = docNorm.indexOf(searchNorm);
    if (normalizedExactPos !== -1) {
        // Found a match after normalization. We need to map the normalized position 
        // back to the original text position. This is non-trivial. 
        // Simplification: Use fuzzy matching on the original text instead.
        console.log(`[FUNC] Found normalized exact match, but falling back to fuzzy on original text for accurate positioning.`);
    }

    // Try fuzzy matching with improved algorithm
    console.log(`[FUNC] No exact match found for: "${searchText.substring(0, 30)}...". Using fuzzy matching on original text.`);
    const fuzzyResult = findTextPositionWithFuzzy(originalText, searchText); // Use original search text here
    
    if (fuzzyResult) {
        console.log(`[FUNC] Fuzzy match successful - position: [${fuzzyResult.start}:${fuzzyResult.end}]`);
    } else {
        // Last resort: Try matching the first sentence if the text is long
        if (searchText.length > 100) {
            const firstSentence = searchText.split(/[.!?](\s|$)/)[0];
            if (firstSentence && firstSentence.length > 20) {
                console.log(`[FUNC] Attempting match with first sentence: "${firstSentence.substring(0, 30)}..."`);
                // Recursion could be risky, call fuzzy directly
                const firstSentenceResult = findTextPositionWithFuzzy(originalText, firstSentence);
                 if (firstSentenceResult) {
                    console.log(`[FUNC] First sentence fuzzy match successful.`);
                    return firstSentenceResult;
                 } else {
                    console.warn(`[FUNC] First sentence fuzzy match failed.`);
                 }
            }
        }
        
        console.warn(`[FUNC] All matching strategies failed for text: "${searchText.substring(0, 50)}..."`);
    }
    
    return fuzzyResult; // Return result of fuzzy match (or null if it failed)
}
// ---------> END: IMPROVED Backend Position Finding Utilities <---------


console.log('--- analyze-document: Defined helpers ---');

// ---------> Type Definitions for Payloads and Results <---------

// Expected structure of the request body
interface RequestBody {
    documentId?: string;
    analysisType: string; // Consider making this a specific union type 'summary' | 'entities' | ...
    customPrompt?: string;
    documentText: string;
    userId?: string;
}

// Shape for individual analysis items (Entity, Clause, Risk, etc.) before position finding
interface BaseAnalysisItem {
    text?: string; // Usually present, but might be missing (e.g., some risks)
    // Other properties specific to the analysis type (e.g., 'type', 'title', 'severity')
    type?: string; // Common property for entities
    title?: string; // Common property for clauses, risks
    severity?: string; // Property for risks
    explanation?: string; // Property for risks, privileged terms
    suggestion?: string; // Property for risks
    date?: string; // Property for timeline
    event?: string; // Property for timeline
    category?: string; // Property for privileged terms
    analysis?: string; // Property for clauses
}

// Shape for individual analysis items after position finding
interface ProcessedAnalysisItem extends BaseAnalysisItem {
    start: number | null;
    end: number | null;
}

// Union type for analysis items that could exist in the result object
// Define basic structures for expected item types
interface Entity extends BaseAnalysisItem { type: string; text: string; }
interface Clause extends BaseAnalysisItem { title: string; text: string; analysis: string; }
interface Risk extends BaseAnalysisItem { title: string; severity: string; explanation: string; suggestion?: string; text?: string; }
interface TimelineEvent extends BaseAnalysisItem { date: string; event: string; type?: string; text: string; }
interface PrivilegedTerm extends BaseAnalysisItem { text: string; category: string; explanation: string; }

type AnyAnalysisItem = Entity | Clause | Risk | TimelineEvent | PrivilegedTerm;

// Structure of the parsed JSON result from OpenAI
// It could be an object containing arrays of items, or a specific structure for summary, or an error object
type ParsedAnalysisResultData = {
    [key in 'entities' | 'clauses' | 'risks' | 'timeline' | 'privilegedTerms']?: AnyAnalysisItem[];
} | {
    summary?: string;
    summaryAnalysis?: string;
};

type ParsedAnalysisResult = ParsedAnalysisResultData | {
    error: string;
    rawResponse: string;
} | string; // Can also be just a string for 'custom' analysis type

// Structure of the result after adding positions
// Similar to ParsedAnalysisResult but items have start/end
type ProcessedAnalysisResultData = {
    [key in 'entities' | 'clauses' | 'risks' | 'timeline' | 'privilegedTerms']?: ProcessedAnalysisItem[];
} | {
    summary?: string;
    summaryAnalysis?: string;
};

type ProcessedAnalysisResult = ProcessedAnalysisResultData | {
    error: string;
    rawResponse: string;
} | string;

// More specific shape for potential OpenAI API errors
interface OpenAIErrorShape extends Error {
    response?: {
        data?: {
            error?: {
                message?: string;
            };
        };
    };
}

// ---------> End: Type Definitions <---------


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
    let body: RequestBody; // Use defined interface
    try {
      body = await req.json() as RequestBody;
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
    const originalText = documentText; // Keep the full original text

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
      // Use type assertion for better type safety
      const typedError = error as OpenAIErrorShape;
      const detail = typedError.response?.data?.error?.message || typedError.message || 'Unknown API error';
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
    let parsedResult: ParsedAnalysisResult = resultText; // Use defined type
    let parseError: Error | null = null;
    if (responseFormat?.type === "json_object") {
      try {
        parsedResult = JSON.parse(resultText);
        // Ensure the top-level key exists if expected (e.g., { entities: [...] })
        const expectedKey = ['entities', 'clauses', 'risks', 'timeline', 'privilegedTerms'].find(k => k === analysisType);
        // Check if parsedResult is an object before using Object.hasOwn
        if (expectedKey && typeof parsedResult === 'object' && parsedResult !== null && !('error' in parsedResult) && !Object.hasOwn(parsedResult, expectedKey)) {
          console.warn(`[${requestStartTime}] Parsed JSON, but missing expected key '${expectedKey}'. Raw:`, resultText.substring(0, 100));
          // Attempt to adapt if result is just the array, e.g. [{"text":...}]
          if (Array.isArray(parsedResult)) {
            console.log(`[${requestStartTime}] Adapting raw array result to expected key '${expectedKey}'.`);
            parsedResult = { [expectedKey]: parsedResult };
          } else {
             // Or handle other potential malformations
          }
        }
        console.log(`[${requestStartTime}] JSON result parsed successfully.`);
      } catch (error) {
        console.error(`[${requestStartTime}] Failed to parse expected JSON result:`, error);
        console.error(`[${requestStartTime}] Raw non-JSON result from LLM: ${resultText.substring(0, 500)}...`);
        const errorMessage = error instanceof Error ? error.message : String(error);
        parsedResult = {
          error: `AI model did not return valid JSON as requested. Parse Error: ${errorMessage}`,
          rawResponse: resultText
        };
        parseError = error instanceof Error ? error : new Error(String(error)); // Assign error object
      }
    }

    // ---> 7. Process Results for Accurate Positions <--- 
    // Initialize processedResult. Start with parsedResult and modify in place if it's an object.
    const processedResult: ProcessedAnalysisResult = JSON.parse(JSON.stringify(parsedResult)); 

    // Check if it's an object and not the error shape before processing
    if (processedResult && typeof processedResult === 'object' && !('rawResponse' in processedResult) && !('error' in processedResult) && !parseError && typeof processedResult !== 'string') {
        console.log(`[${requestStartTime}] Finding accurate positions for ${analysisType}...`);
        const resultKeys: Array<'entities' | 'clauses' | 'risks' | 'timeline' | 'privilegedTerms'> = ['entities', 'clauses', 'risks', 'timeline', 'privilegedTerms'];
        let itemsProcessed = 0;
        let itemsFound = 0;

        // Progressive processing with exponential backoff for large documents
        for (const key of resultKeys) {
            // Use Object.hasOwn for safer property checking
            // Also ensure processedResult is not a string or null before checking keys
            if (typeof processedResult === 'object' && processedResult !== null && Object.hasOwn(processedResult, key)) {
                 // Type assertion to access the specific key safely after check
                 // We expect BaseAnalysisItem[] initially from parsedResult
                const items: BaseAnalysisItem[] | undefined = (processedResult as ParsedAnalysisResultData)[key]; 

                if(Array.isArray(items)) {
                    // Now items is confirmed to be an array of BaseAnalysisItem
                    const verifiedItems: ProcessedAnalysisItem[] = []; // Target type is ProcessedAnalysisItem[]
                    console.log(`[${requestStartTime}] Processing ${items.length} items for key: ${key}`);
                    
                    for (const item of items) { // No type assertion needed here, item is BaseAnalysisItem
                        itemsProcessed++;
                        if (!item) continue;
                        
                        // Create a new object that adheres to ProcessedAnalysisItem structure
                        const processedItem: ProcessedAnalysisItem = { 
                            ...item, // Spread properties from BaseAnalysisItem
                            start: null, // Initialize position properties
                            end: null 
                        };

                        // Determine the text to search for based on analysis type
                        let textToFind = '';
                        if (typeof item.text === 'string') {
                            textToFind = item.text;
                        } else if (key === 'risks' && typeof item.explanation === 'string') { // Special handling for risks
                            // For risks, maybe search for a portion of the explanation if text is missing?
                            textToFind = item.explanation.substring(0, Math.min(150, item.explanation.length));
                            console.log(`[${requestStartTime}] Risk item missing text, using explanation snippet: "${textToFind.substring(0,30)}..."`);
                        }
                        // Add other special cases if needed for timeline, etc.
                        
                        // Find position if we have text to find
                        if (!textToFind || typeof textToFind !== 'string' || !textToFind.trim()) {
                            console.warn(`[${requestStartTime}] Keeping item without position - No searchable text found or invalid text for key '${key}':`, item);
                            // start/end are already null in processedItem
                        } else {
                            // Find position with improved utility
                            const position = findAccuratePosition(originalText, textToFind);
                            
                            if (position) {
                                // Update position on the new object
                                processedItem.start = position.start;
                                processedItem.end = position.end;
                                itemsFound++;
                            } else {
                                // No position found - start/end remain null
                                console.warn(`[${requestStartTime}] Keeping item without position - Could not find text for key '${key}': "${textToFind.substring(0, 50)}..."`);
                            }
                        } 
                        // Push the processedItem (which now has start/end null by default)
                        verifiedItems.push(processedItem); 
                    }
                    
                    // Update results with positions
                    // Assign the array of ProcessedAnalysisItem back to the correct key in processedResult
                    (processedResult as ProcessedAnalysisResultData)[key] = verifiedItems; 
                } else {
                     console.warn(`[${requestStartTime}] Expected key '${key}' to be an array, but found:`, typeof items);
                }
            }
        }
        
        // No need to reassign parsedResult to processedResult here, 
        // processedResult was modified in place if it was an object.
        // If parsedResult was a string initially, processedResult remains that string.
        console.log(`[${requestStartTime}] Position finding complete. Items processed: ${itemsProcessed}, Positions found: ${itemsFound}`);
    }
    // ---> End Position Processing <--- 

    // 8. Store in DB (if documentId provided)
    let analysisRecordId = null;
    // Ensure processedResult is suitable for storing (handle string case if necessary)
    const resultToStore = typeof processedResult === 'string' ? { custom_analysis: processedResult } : processedResult;

    if (documentId) {
      try {
        const analysisToStore = {
          document_id: documentId,
          user_id: userId || null,
          analysis_type: analysisType,
          result: resultToStore, // Store the potentially adapted result
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

    // 9. Return success response
    const requestEndTime = Date.now();
    console.log(`[${requestStartTime}] Returning success response (${requestEndTime - requestStartTime}ms total).`);
    return new Response(JSON.stringify({ 
      success: true, 
      analysisId: analysisRecordId, 
      result: processedResult // Return the result with accurate positions
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