import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { OpenAI } from 'npm:openai@^4.0.0'; // Use npm specifier
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

console.log('Initializing create-template-from-ai function...');

// --- Configuration ---
const AI_MODEL = 'gpt-4o-mini'; // Or 'gpt-4o', 'gpt-4-turbo', etc.
const MAX_TOKENS_RESPONSE = 2000; // Adjust as needed for template length

// Initialize Supabase Admin Client (for database operations)
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  // Optionally throw to prevent function execution without DB access
}

// Correctly call createClient with options object
const supabaseAdmin: SupabaseClient = createClient(supabaseUrl!, supabaseServiceKey!, {
  auth: { 
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
  }
});

// --- Helper Function: Sanitize Name ---
function sanitizeName(name: string): string {
  // Remove problematic characters for filenames or display
  return name.replace(/[^a-zA-Z0-9\s-_()]/g, '').trim().substring(0, 100);
}

// --- Main Handler ---
serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Parse Request Body
    const { instructions, category, userId }: { instructions: string; category: string; userId: string } = await req.json();

    // 2. Validate Input
    if (!instructions || typeof instructions !== 'string' || instructions.trim().length === 0) {
      throw new Error("Missing or invalid 'instructions' in request body.");
    }
    if (!category || typeof category !== 'string' || category.trim().length === 0) {
      throw new Error("Missing or invalid 'category' in request body.");
    }
    if (!userId || typeof userId !== 'string') {
      throw new Error("Missing or invalid 'userId' in request body.");
    }

    console.log(`Received request: userId=${userId}, category=${category}`);

    // 3. Initialize OpenAI Client
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable not set.');
    }
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // 4. Construct Prompt for AI
    //    - Explicitly request template name generation.
    //    - **Crucially, demand the {{Placeholder Name}} format.**
    const systemPrompt = `You are an AI assistant specialized in drafting legal document templates. Your goal is to generate a high-quality, reusable template based on user instructions.

IMPORTANT INSTRUCTIONS:
1.  Analyze the user's request and the specified category (${category}).
2.  Generate a suitable, concise name for this template.
3.  Generate the template content.
4.  **CRITICAL: Identify all placeholders or variable fields (e.g., names, dates, specific amounts, addresses) and format them strictly as {{Placeholder Name}}. Do NOT use brackets [], <>, or any other format.** Examples:
    - Correct: {{Client Name}}, {{Effective Date}}, {{Case Number}}, {{Plaintiff Full Name}}
    - Incorrect: [Client Name], <Date>, {Amount}, **Variable**
5.  Structure the output as a JSON object with two keys: "templateName" (string) and "templateContent" (string containing the full template with placeholders).
6.  Ensure the content is professional, legally sound (for common scenarios, disclaimer: you are an AI), and relevant to the '${category}' category.
7.  Do not include explanations or introductions outside the JSON structure.`;

    const userPrompt = `User Instructions: ${instructions}`; // Keep user prompt simple

    console.log('Sending request to OpenAI model:', AI_MODEL);

    // 5. Call OpenAI API (Non-Streaming)
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: "json_object" }, // Request JSON output
      temperature: 0.4, // Lower temperature for more deterministic template structure
      max_tokens: MAX_TOKENS_RESPONSE,
    });

    const aiResultContent = response.choices[0]?.message?.content;

    if (!aiResultContent) {
      console.error('OpenAI response content was null or empty:', response);
      throw new Error('AI model did not return valid content.');
    }

    // 6. Parse AI Response (expecting JSON)
    let generatedName: string;
    let generatedContent: string;
    try {
      const parsedResult: { templateName?: string; templateContent?: string } = JSON.parse(aiResultContent);
      if (typeof parsedResult.templateName !== 'string' || typeof parsedResult.templateContent !== 'string') {
        throw new Error('AI response JSON did not contain valid templateName or templateContent strings.');
      }
      generatedName = sanitizeName(parsedResult.templateName);
      generatedContent = parsedResult.templateContent;
      if (!generatedName) generatedName = `${category} Template (Generated)`; // Fallback name
      if (!generatedContent) throw new Error('AI generated empty template content.');

      console.log(`AI generated template: Name="${generatedName}"`);
    } catch (parseError) {
      console.error('Failed to parse JSON response from AI:', parseError);
      console.error('Raw AI content:', aiResultContent); // Log raw content for debugging
      // Attempt to use raw content as fallback if parsing fails?
      // generatedName = `${category} Template (Generated)`;
      // generatedContent = aiResultContent; // Risky - might not be valid template
      throw new Error(`AI did not return valid JSON: ${parseError.message}`);
    }

    // 7. (Optional but Recommended) Post-process/Validate Placeholders
    // Example: Find {{...}} and potentially warn/log if other formats like [...] exist
    const placeholders = Array.from(generatedContent.matchAll(/\{\{([^}]+?)\}\}/g)).map(m => m[1].trim());
    console.log(`Extracted placeholders: ${placeholders.length > 0 ? placeholders.join(', ') : 'None'}`);
    // Add more sophisticated validation here if needed.

    // 8. Save to Database
    console.log(`Attempting to save template "${generatedName}" to database...`);
    const { data: dbData, error: dbError } = await supabaseAdmin
      .from('document_templates')
      .insert({
        name: generatedName,
        description: `AI-generated based on instructions: "${instructions.substring(0, 100)}..."`, // Auto-generate description
        category: category.toLowerCase(), // Ensure lowercase category
        content: generatedContent,
        variables: placeholders, // Save extracted placeholders
        tags: ['ai-generated'], // Add a tag
        user_id: userId,
        is_public: false, // Default to private
      })
      .select('id') // Select the ID of the newly inserted row
      .single(); // Expect only one row back

    if (dbError) {
      console.error('Database error saving template:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    if (!dbData || !dbData.id) {
      console.error('Database insert succeeded but did not return an ID.');
      throw new Error('Failed to retrieve new template ID after saving.');
    }

    const newTemplateId = dbData.id;
    console.log(`Template saved successfully with ID: ${newTemplateId}`);

    // 9. Return Success Response
    return new Response(
      JSON.stringify({ success: true, templateId: newTemplateId }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    // 10. Handle Errors
    console.error('Error in create-template-from-ai function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error instanceof Error && error.message.startsWith('Missing') ? 400 : 500, // Bad Request for input errors
      }
    );
  }
}); 