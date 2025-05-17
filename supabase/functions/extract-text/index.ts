// REMOVE SHIMS - No longer needed for pdf-parse

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
// --- CHANGE: Remove unpdf ---
// import { getDocumentProxy, extractText as extractPdfText } from 'npm:unpdf@^0.12';

// Import Buffer for pdf-parse
import { Buffer } from "node:buffer"; 

// Import pdf-parse using default import
import pdfParse from 'npm:pdf-parse@1.1.1';

// --- CHANGE: Import mammoth for DOCX ---
import { extractRawText as extractDocxText } from 'npm:mammoth@1.6.0';

// --- CHANGE: Import node-html-parser for HTML ---
import { parse as parseHtml } from 'npm:node-html-parser@6.1.12';


// --- Helper: Create Supabase Admin Client (SERVICE_ROLE) ---
function createSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'X-Client-Info': 'supabase-js-edge@v2.39.8' } } // Added for compatibility
  });
}

// --- Helper: Update Document Status and Text ---
async function updateDocument(supabaseAdmin: SupabaseClient, documentId: string, updates: Record<string, unknown>) {
  console.log(`Updating document ${documentId} with status: ${updates.processing_status}`);
  const { error: updateError } = await supabaseAdmin.from('documents').update(updates).eq('id', documentId);
  if (updateError) {
    console.error(`Error updating document ${documentId}:`, updateError);
  // Log the error, but don't throw
  }
}

// --- PDF Extraction Logic using pdf-parse ---
async function extractTextFromPdf(data: Uint8Array): Promise<string> {
  try {
    console.log('Loading PDF document with pdf-parse...');
    
    const buffer = Buffer.from(data);
    // Use the default import name
    const pdfData = await pdfParse(buffer);
    
    console.log(`Extracted ${pdfData.text.length} characters from PDF.`);
    // Replace null bytes using a more common regex for null character
    return pdfData.text.replace(/\0/g, ''); 
  } catch (error) {
    console.error('Error extracting text from PDF with pdf-parse:', error);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

// --- DOCX Extraction Logic (using mammoth) ---
async function extractTextFromDocx(data: Uint8Array): Promise<string> {
  try {
    console.log('Loading DOCX document with mammoth...');
    // mammoth expects an object with arrayBuffer property
    const result = await extractDocxText({ buffer: data.buffer });
    console.log(`Extracted ${result.value.length} characters from DOCX.`);
    return result.value;
  } catch (error) {
    console.error('Error extracting text from DOCX with mammoth:', error);
    throw new Error(`Failed to parse DOCX: ${error.message}`);
  }
}

// --- CHANGE: Add HTML Extraction Logic ---
async function extractTextFromHtml(data: Uint8Array): Promise<string> {
  try {
    console.log('Parsing HTML document...');
    const htmlString = new TextDecoder().decode(data);
    const root = parseHtml(htmlString);
    const text = root.innerText || root.textContent || '';
    console.log(`Extracted ${text.length} characters from HTML.`);
    return text;
  } catch (error) {
    console.error('Error extracting text from HTML:', error);
    throw new Error(`Failed to parse HTML: ${error.message}`);
  }
}


// --- Main Function Handler ---
serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }

  const supabaseAdmin = createSupabaseAdminClient();
  let documentId: string | null = null; // Explicit type
  
  try {
    // FIX: Restore payload parsing and variable definition
    const payload = await req.json();
    console.log('Webhook payload received:', JSON.stringify(payload).substring(0, 200) + '...');

    if (payload.type !== 'INSERT' || !payload.record) {
      console.warn('Payload is not an INSERT or missing record:', payload.type);
      return new Response(JSON.stringify({ error: 'Invalid payload type or structure' }), { status: 400 });
    }

    const record = payload.record;
    documentId = record.id as string; // Assign documentId
    const storagePath = record.storage_path as string;
    const contentType = (record.content_type?.toLowerCase() || '') as string; // Normalize content type
    const filename = (record.filename || 'unknown') as string; // Get filename

    if (!documentId || !storagePath) {
      console.error('Missing documentId or storage_path in payload record');
      return new Response(JSON.stringify({ error: 'Missing documentId or storage_path' }), { status: 400 });
    }
    console.log(`Processing document ID: ${documentId}, Path: ${storagePath}, Type: ${contentType}, Filename: ${filename}`);

    await updateDocument(supabaseAdmin, documentId, { processing_status: 'text_extraction_pending' });

    // FIX: Restore file download logic
    console.log(`Downloading document from path: ${storagePath}`);
    const { data: blobData, error: downloadError } = await supabaseAdmin.storage.from('documents').download(storagePath);
    if (downloadError) {
      console.error(`Error downloading document ${storagePath}:`, downloadError);
      throw new Error(`Failed to download document: ${downloadError.message}`);
    }
    if (!blobData) {
      throw new Error(`No content downloaded for document: ${storagePath}`);
    }
    console.log(`Successfully downloaded ${filename} (${blobData.size} bytes)`);

    const fileData = new Uint8Array(await blobData.arrayBuffer());

    // 4. Extract text based on content type
    let extractedText = '';
    console.log(`Attempting extraction for contentType: ${contentType}, filename: ${filename}`);

    // --- Updated extraction logic --- 
    if (contentType === 'application/pdf') {
      extractedText = await extractTextFromPdf(fileData);
    } else if (contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || filename.endsWith('.docx')) {
      extractedText = await extractTextFromDocx(fileData);
    } else if (contentType.startsWith('text/html') || filename.endsWith('.html') || filename.endsWith('.htm')) {
      extractedText = await extractTextFromHtml(fileData);
    } else if (contentType.startsWith('text/') || filename.endsWith('.md') || filename.endsWith('.txt')) { 
      console.log(`Processing plain text, markdown or txt file: ${filename}`);
      extractedText = new TextDecoder().decode(fileData);
    } else if (contentType === 'application/msword' || filename.endsWith('.doc')) {
      console.warn(`Legacy .doc file detected: ${filename}. Text extraction is currently not supported for this format.`);
      await updateDocument(supabaseAdmin, documentId, {
        processing_status: 'text_extraction_failed',
        error_message: `Unsupported content type: ${contentType} (.doc files cannot be processed currently)`
      });
      return new Response(JSON.stringify({ message: `Unsupported content type: ${contentType} (.doc)` }), { status: 200 });
    } else { 
      console.warn(`Unsupported content type for extraction: ${contentType} (${filename})`);
      await updateDocument(supabaseAdmin, documentId, {
        processing_status: 'text_extraction_failed',
        error_message: `Unsupported content type: ${contentType}`
      });
      return new Response(JSON.stringify({ message: `Unsupported content type: ${contentType}` }), { status: 200 }); 
    }

    // Clean and normalize the extracted text
    const normalizedText = extractedText
      .replace(/[\\u0000]/g, '') // FIX: Escaped backslash in null byte regex
      .replace(/\s+/g, ' ')
      .replace(/ \n/g, '\n')
      .trim();

    console.log(`Extraction successful. Normalized text length: ${normalizedText.length}`);

    // 5. Update the document record with extracted text and final status
    await updateDocument(supabaseAdmin, documentId, {
      extracted_text: normalizedText,
      processing_status: 'text_extracted',
      error_message: null
    });

    return new Response(JSON.stringify({ success: true, message: `Document ${documentId} processed successfully.` }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error in extract-text function:', error);
    if (documentId && supabaseAdmin) {
      await updateDocument(supabaseAdmin, documentId, { // Ensure documentId has correct type here
        processing_status: 'text_extraction_failed',
        error_message: error.message || 'Unknown extraction error'
      });
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}); 