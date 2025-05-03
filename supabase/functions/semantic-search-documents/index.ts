import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { OpenAI } from 'https://deno.land/x/openai@v4.52.7/mod.ts';

// --- Configuration ---
const EMBEDDING_MODEL = 'text-embedding-ada-002';
const DEFAULT_MATCH_THRESHOLD = 0.75; // Adjust as needed
const DEFAULT_MATCH_COUNT = 5;

console.log('Function init: semantic-search-documents');

// --- Helper: Create OpenAI Client ---
function createOpenAIClient() {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('Missing environment variable: OPENAI_API_KEY');
  }
  return new OpenAI({ apiKey });
}

// --- Helper: Create Supabase Admin Client (SERVICE_ROLE) ---
function createSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
}

// Define the expected structure of the data returned by the RPC function
interface MatchResult {
    document_id: string;
    filename: string;
    chunk_text: string;
    similarity: number;
    case_id: string | null;
}

// --- CORS Headers --- 
// Standard headers required by Supabase Functions
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Allow requests from any origin (adjust in production if needed)
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


// --- Main Function Handler ---
serve(async (req) => {
  // Handle OPTIONS preflight requests for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('Received request for semantic document search');

  try {
    // Check POST method after handling OPTIONS
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: corsHeaders });
    }

    console.log('Attempting to parse request body...');
    const body = await req.json();
    console.log('Request body parsed successfully:', body);

    const { query, match_threshold, match_count } = body;
    console.log('Extracted fields:', { query, match_threshold, match_count });

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      console.log('Query validation failed.');
      return new Response(JSON.stringify({ error: 'Missing or invalid query parameter' }), { status: 400, headers: corsHeaders });
    }

    const threshold = typeof match_threshold === 'number' ? match_threshold : DEFAULT_MATCH_THRESHOLD;
    const count = typeof match_count === 'number' ? match_count : DEFAULT_MATCH_COUNT;

    console.log(`Searching for: "${query}", Threshold: ${threshold}, Count: ${count}`);

    // Initialize clients
    const openai = createOpenAIClient();
    const supabaseAdmin = createSupabaseAdminClient();

    // Generate query embedding
    console.log('Generating embedding for query...');
    const embeddingResponse = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: query.trim(),
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;
    console.log('Query embedding generated.');

    // Call Supabase RPC function
    console.log('Calling Supabase RPC function match_document_chunks...');
    const { data: matchData, error: rpcError } = await supabaseAdmin.rpc('match_document_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: count,
    });

    if (rpcError) {
      console.error('Error calling RPC function match_document_chunks:', rpcError);
      throw new Error(`Database search error: ${rpcError.message}`);
    }

    console.log(`Found ${matchData?.length ?? 0} potential matches.`);

    const results: MatchResult[] = matchData || [];

    // Format and return results
    const groupedResults = results.reduce((acc, match) => {
        if (!acc[match.document_id]) {
            acc[match.document_id] = {
                documentId: match.document_id,
                filename: match.filename,
                caseId: match.case_id,
                matches: [],
            };
        }
        if (!acc[match.document_id].matches.some(m => m.chunkText === match.chunk_text)) {
            acc[match.document_id].matches.push({
                chunkText: match.chunk_text,
                similarity: match.similarity,
            });
        }
        acc[match.document_id].matches.sort((a, b) => b.similarity - a.similarity);
        return acc;
    }, {} as Record<string, { documentId: string; filename: string; caseId: string | null; matches: { chunkText: string; similarity: number }[] }>);

    const finalResults = Object.values(groupedResults).map(group => ({
        documentId: group.documentId,
        filename: group.filename,
        caseId: group.caseId,
        matches: group.matches.slice(0, 1)
    }));

     finalResults.sort((a, b) => b.matches[0].similarity - a.matches[0].similarity);

    console.log(`Returning ${finalResults.length} unique document results.`);

    // Add CORS headers to the success response
    return new Response(JSON.stringify({ success: true, results: finalResults }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error within serve handler:', error);
    // Add CORS headers to the error response
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/*
-- Example Supabase SQL for the RPC function `match_document_chunks`
-- Make sure the `pgvector` extension is enabled and you have an index
-- on the `embedding` column in `document_chunks`.

CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding vector(1536), -- Match the size of your embeddings (e.g., 1536 for ada-002)
  match_threshold float,
  match_count int
  -- Optional: Add user_id filter if needed
  -- query_user_id uuid
)
RETURNS TABLE (
  document_id uuid,
  filename text, -- Join with documents table to get filename
  chunk_text text,
  similarity float
)
LANGUAGE sql STABLE -- Important for read-only functions
AS $$
  SELECT
    dc.document_id,
    d.filename, -- Get filename from the documents table
    dc.chunk_text,
    1 - (dc.embedding <=> query_embedding) AS similarity -- Calculate cosine similarity
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id -- Join to get filename
  WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
  -- Optional: Add user filtering based on document ownership if RLS isn't sufficient
  -- AND d.owner_id = query_user_id
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

*/ 