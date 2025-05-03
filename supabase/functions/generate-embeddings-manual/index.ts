import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { OpenAI } from 'https://deno.land/x/openai@v4.52.7/mod.ts';

// --- Configuration ---
const EMBEDDING_MODEL = 'text-embedding-ada-002';
const CHUNK_SIZE = 1000; // tokens per chunk
const CHUNK_OVERLAP = 200; // overlap between chunks
const MAX_DOCUMENTS_PER_RUN = 5; // Process only a few documents per function call

// --- Helper Functions ---
function createSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
}

function createOpenAIClient() {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('Missing OPENAI_API_KEY');
  }
  return new OpenAI({ apiKey: openaiApiKey });
}

// Function to split text into chunks
function chunkText(text: string, maxChunkSize: number = CHUNK_SIZE, overlap: number = CHUNK_OVERLAP): string[] {
  if (!text || text.trim().length === 0) {
    console.warn('Empty text provided for chunking');
    return [];
  }
  
  // Simple chunking by characters for now
  // In production, you might want more sophisticated tokenization
  const chunks: string[] = [];
  let startIndex = 0;
  
  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + maxChunkSize, text.length);
    const chunk = text.substring(startIndex, endIndex);
    chunks.push(chunk);
    
    // Move start index for next chunk, accounting for overlap
    startIndex = endIndex - overlap;
    if (startIndex >= text.length || startIndex <= 0) break;
  }
  
  return chunks;
}

// --- CORS Headers --- 
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Main Function Handler ---
serve(async (req) => {
  // Handle OPTIONS preflight requests for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('Manual embedding generation function started');

  try {
    // Check authentication - this should be a POST request
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Initialize clients
    const supabaseAdmin = createSupabaseAdminClient();
    const openai = createOpenAIClient();
    
    // Step 1: Find documents with extracted_text but no chunks in document_chunks table
    console.log('Finding documents that need embeddings...');
    
    const { data: documents, error: documentsError } = await supabaseAdmin
      .from('documents')
      .select('id, filename, extracted_text')
      .not('extracted_text', 'is', null)
      .not('processing_status', 'eq', 'completed')
      .limit(MAX_DOCUMENTS_PER_RUN);
    
    if (documentsError) {
      console.error('Error querying documents:', documentsError);
      throw new Error(`Database query error: ${documentsError.message}`);
    }
    
    console.log(`Found ${documents?.length || 0} documents that need embeddings`);
    
    if (!documents || documents.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No documents found needing embeddings', 
        processedCount: 0 
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    // Step 2: Process each document
    let successCount = 0;
    let errorCount = 0;
    const results = [];
    
    for (const document of documents) {
      try {
        console.log(`Processing document ${document.id} (${document.filename})...`);
        
        if (!document.extracted_text) {
          console.warn(`Document ${document.id} has null extracted_text despite query filter`);
          throw new Error('Document has no extracted text');
        }
        
        // Split the document text into chunks
        const chunks = chunkText(document.extracted_text);
        console.log(`Created ${chunks.length} chunks for document`);
        
        // Process each chunk
        for (const [index, chunkText] of chunks.entries()) {
          try {
            console.log(`Generating embedding for chunk ${index + 1}/${chunks.length}...`);
            
            // Generate embedding via OpenAI
            const embeddingResponse = await openai.embeddings.create({
              model: EMBEDDING_MODEL,
              input: chunkText,
            });
            
            // Insert the chunk with its embedding
            const { error: insertError } = await supabaseAdmin
              .from('document_chunks')
              .insert({
                document_id: document.id,
                chunk_text: chunkText,
                embedding: embeddingResponse.data[0].embedding,
              });
            
            if (insertError) {
              console.error(`Error inserting chunk ${index} for document ${document.id}:`, insertError);
              throw new Error(`Failed to insert chunk: ${insertError.message}`);
            }
          } catch (chunkError) {
            console.error(`Error processing chunk ${index} for document ${document.id}:`, chunkError);
            // Continue with next chunk even if this one fails
          }
        }
        
        // Update document status to completed
        const { error: updateError } = await supabaseAdmin
          .from('documents')
          .update({ processing_status: 'completed' })
          .eq('id', document.id);
        
        if (updateError) {
          console.error(`Error updating document ${document.id} status:`, updateError);
          throw new Error(`Failed to update document status: ${updateError.message}`);
        }
        
        console.log(`Successfully processed document ${document.id}`);
        successCount++;
        results.push({
          documentId: document.id,
          status: 'success',
          chunksCreated: chunks.length
        });
      } catch (documentError) {
        console.error(`Error processing document ${document.id}:`, documentError);
        errorCount++;
        results.push({
          documentId: document.id,
          status: 'error',
          error: documentError instanceof Error ? documentError.message : 'Unknown error'
        });
        
        // Update document status to failed
        try {
          await supabaseAdmin
            .from('documents')
            .update({ 
              processing_status: 'embedding_failed',
              error_message: documentError instanceof Error ? documentError.message : 'Unknown error during embedding'
            })
            .eq('id', document.id);
        } catch (updateError) {
          console.error(`Failed to update error status for document ${document.id}:`, updateError);
        }
      }
    }
    
    // Return results
    return new Response(JSON.stringify({
      success: true,
      processedCount: documents.length,
      successCount,
      errorCount,
      results
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
    
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}); 