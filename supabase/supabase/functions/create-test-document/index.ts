import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

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

  console.log('Create test document function started');

  try {
    // Check authentication - this should be a POST request
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Initialize client
    const supabaseAdmin = createSupabaseAdminClient();
    
    // Create a test document - this will be a text document with legal content ready for embedding
    console.log('Creating test document...');
    
    const documentData = {
      owner_id: '00000000-0000-0000-0000-000000000000', // This will be replaced with the actual user ID from the request
      filename: 'Sample Legal Document for Testing.txt',
      file_type: 'txt',
      file_size: 2000,
      storage_path: 'test/sample-legal-document.txt',
      content_type: 'text/plain',
      processing_status: 'text_extracted', // Set to extracted so the embedding function will pick it up
      extracted_text: `SAMPLE LEGAL AGREEMENT
      
THIS AGREEMENT is made on this 15th day of May, 2023

BETWEEN:

ACME CORPORATION, a company incorporated under the laws of Delaware with company registration number 12345678 and having its registered office at 123 Main Street, Anytown, CA 94101 (hereinafter referred to as "the Company")

AND

JOHN DOE, of 456 Oak Avenue, Somewhere, NY 10001 (hereinafter referred to as "the Consultant")

WHEREAS:

A. The Company is engaged in the business of providing software development services.

B. The Consultant has expertise in artificial intelligence and machine learning.

C. The Company wishes to engage the Consultant to provide certain services as set out in this Agreement.

NOW THEREFORE in consideration of the mutual covenants and agreements contained herein and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the parties hereto agree as follows:

1. INTERPRETATION

1.1 In this Agreement, unless the context otherwise requires, the following expressions shall have the following meanings:

"Confidential Information" means all information, in whatever form, that is disclosed by the Company to the Consultant pursuant to or in connection with this Agreement and that relates to the Company's business, including but not limited to trade secrets, financial information, product information, business plans, marketing strategies, and customer information;

"Deliverables" means all documents, products and materials developed by the Consultant or its agents, contractors and employees as part of or in relation to the Services in any form, including computer programs, data, reports and specifications;

"Intellectual Property Rights" means patents, rights to inventions, copyright and related rights, trademarks, trade names and domain names, rights in get-up, rights in goodwill or to sue for passing off, unfair competition rights, rights in designs, rights in computer software, database rights, topography rights, moral rights, rights in confidential information (including know-how and trade secrets) and any other intellectual property rights, in each case whether registered or unregistered and including all applications for, and renewals or extensions of, such rights, and all similar or equivalent rights or forms of protection in any part of the world;

"Services" means the services to be provided by the Consultant under this Agreement as set out in Schedule 1.

2. APPOINTMENT

2.1 The Company hereby appoints the Consultant to provide the Services on the terms and conditions of this Agreement.

2.2 The Consultant shall provide the Services from the date of this Agreement until terminated in accordance with clause 10.

3. CONSULTANT'S OBLIGATIONS

3.1 The Consultant shall:

(a) provide the Services with reasonable care and skill and in accordance with best industry practice;

(b) comply with all reasonable instructions given by the Company in relation to the Services;

(c) keep the Company informed of progress in relation to the Services and promptly notify the Company if there are any delays or problems in the performance of the Services;

(d) maintain adequate insurance coverage for the provision of the Services.`
    };

    // Check if the request body includes a user ID
    try {
      const body = await req.json();
      if (body.userId) {
        console.log(`Using provided user ID: ${body.userId}`);
        documentData.owner_id = body.userId;
      }
    } catch (parseError) {
      console.warn('No valid JSON body in the request, using default user ID');
    }
    
    // Insert the document
    const { data: document, error: insertError } = await supabaseAdmin
      .from('documents')
      .insert(documentData)
      .select('id, filename')
      .single();
    
    if (insertError) {
      console.error('Error inserting test document:', insertError);
      throw new Error(`Failed to insert test document: ${insertError.message}`);
    }
    
    console.log(`Test document created successfully with ID: ${document.id}`);
    
    // Return success response
    return new Response(JSON.stringify({
      success: true,
      document: {
        id: document.id,
        filename: document.filename
      }
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