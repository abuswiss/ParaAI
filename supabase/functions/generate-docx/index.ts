// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from '../_shared/cors.ts';
// Add Supabase client import
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'; // Or your preferred version

console.log("Hello from Functions!")

Deno.serve(async (req) => {
  const errorId = crypto.randomUUID();
  // Ensure SUPABASE_URL and SUPABASE_ANON_KEY are available for client, or SERVICE_ROLE_KEY for admin actions
  // For storage uploads from a function, service role key is usually needed for broader permissions.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error(`[${errorId}] Missing Supabase environment variables.`);
    return new Response(
      JSON.stringify({ error: "Server configuration error: Missing Supabase credentials.", errorId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }

  const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  console.log(`[${errorId}] Incoming request:`, req.method, Array.from(req.headers.entries()));

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  let bodyText = '';
  try {
    bodyText = await req.text();
    console.log(`[${errorId}] Raw body:`, bodyText);

    const { htmlContent, filename } = JSON.parse(bodyText);

    if (!htmlContent) {
      throw new Error("Missing htmlContent in request body");
    }

    // Import docx and HTML parser
    const docx = await import("npm:docx@8.0.3");
    const { Document, Paragraph, Packer, TextRun, HeadingLevel } = docx.default;
    const { parse } = await import("npm:node-html-parser@6.1.11");

    // Parse HTML
    const root = parse(htmlContent);

    // Helper to recursively convert HTML nodes to DOCX elements
    function htmlToDocxElements(node) {
      if (!node) return [];
      if (node.nodeType === 3) { // Text node
        return [new TextRun(node.rawText)];
      }
      if (node.tagName === 'BR') {
        return [new TextRun({ text: '', break: 1 })];
      }
      if (node.tagName === 'STRONG' || node.tagName === 'B') {
        return [new TextRun({ text: node.text, bold: true })];
      }
      if (node.tagName === 'EM' || node.tagName === 'I') {
        return [new TextRun({ text: node.text, italics: true })];
      }
      if (node.tagName === 'U') {
        return [new TextRun({ text: node.text, underline: {} })];
      }
      if (node.tagName === 'SPAN') {
        // Special handling for variable spans
        const variableName = node.getAttribute('data-variable-name');
        if (variableName) {
          return [new TextRun({ text: node.text, color: 'FF6600', bold: true })];
        }
        return [new TextRun(node.text)];
      }
      // Recursively process children for inline tags
      const children = node.childNodes.flatMap(htmlToDocxElements);

      // Block-level tags
      if (node.tagName === 'H1') {
        return [new Paragraph({ children, heading: HeadingLevel.HEADING_1 })];
      }
      if (node.tagName === 'H2') {
        return [new Paragraph({ children, heading: HeadingLevel.HEADING_2 })];
      }
      if (node.tagName === 'H3') {
        return [new Paragraph({ children, heading: HeadingLevel.HEADING_3 })];
      }
      if (node.tagName === 'P') {
        return [new Paragraph({ children })];
      }
      if (node.tagName === 'LI') {
        return [new Paragraph({ children, bullet: { level: 0 } })];
      }
      if (node.tagName === 'UL' || node.tagName === 'OL') {
        return node.childNodes.flatMap(htmlToDocxElements);
      }
      // Fallback: just return children
      return children;
    }

    // Convert HTML to DOCX elements
    const docxElements = root.childNodes.flatMap(htmlToDocxElements);

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: docxElements,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    // Instead of returning the buffer directly:
    // 1. Define file name and path for storage
    const storageFileName = `${crypto.randomUUID()}-${(filename || 'document').replace(/[^a-zA-Z0-9._-]/g, '_')}.docx`;
    const storagePath = `generated-documents/${storageFileName}`; // Example bucket and path

    // 2. Upload to Supabase Storage
    console.log(`[${errorId}] Uploading ${storagePath} to Supabase storage...`);
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('generated-documents') // Ensure this bucket exists and has appropriate policies
      .upload(storagePath, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true, // Overwrite if file with same name exists (optional, consider unique names)
      });

    if (uploadError) {
      console.error(`[${errorId}] Storage upload error:`, uploadError);
      throw new Error(`Failed to upload document to storage: ${uploadError.message}`);
    }
    console.log(`[${errorId}] File uploaded successfully:`, uploadData?.path);

    // 3. Create a signed URL for download
    // Expires in 1 hour (3600 seconds) - adjust as needed
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('generated-documents')
      .createSignedUrl(storagePath, 3600); 

    if (signedUrlError) {
      console.error(`[${errorId}] Signed URL creation error:`, signedUrlError);
      throw new Error(`Failed to create signed URL: ${signedUrlError.message}`);
    }

    console.log(`[${errorId}] Signed URL generated:`, signedUrlData?.signedUrl);

    // 4. Return JSON response with the signed URL and original filename
    return new Response(
      JSON.stringify({
        success: true,
        downloadUrl: signedUrlData.signedUrl,
        fileName: (filename || 'document').replace(/[^a-zA-Z0-9._-]/g, '_') + '.docx', // Send back the original intended filename
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    // Log error with stack trace and errorId
    console.error(`[${errorId}] Error in generate-docx:`, error, "Body was:", bodyText, "Stack:", error?.stack);
    return new Response(
      JSON.stringify({ error: error.message, errorId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/generate-docx' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
