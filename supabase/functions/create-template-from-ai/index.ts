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
  return name.replace(/[^a-zA-Z0-9\s_\-\(\)]/g, '').trim().substring(0, 100);
}

// --- Helper Function: Ensure Variable Span Format ---
function ensureSpanFormat(content: string): string {
  // Convert {{Placeholder Name}} to <span...> format
  content = content.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, varNameMatch) => {
    const varName = varNameMatch.trim();
    const description = `Value for ${varName}`; // Default description
    console.log(`Post-processing: Converted {{${varName}}} to span format.`);
    return `<span data-variable-name="${varName}" data-variable-description="${description}" class="variable-highlight">${varName}</span>`;
  });

  // Ensure existing spans have necessary attributes and class
  // Use a simple regex for this example, more robust parsing might be needed for complex HTML
  const spanRegex = /<span\s+data-variable-name="([^"]+)"([^>]*)>([^<]+)<\/span>/g;
  content = content.replace(spanRegex, (match, name, attrs, innerText) => {
    const existingDescriptionMatch = attrs.match(/data-variable-description="([^"]+)"/);
    let description = existingDescriptionMatch ? existingDescriptionMatch[1] : `Value for ${name}`;
    if (!description) description = `Value for ${name}`; // Ensure description exists
    
    // Reconstruct the span tag cleanly, ensuring class="variable-highlight"
    return `<span data-variable-name="${name}" data-variable-description="${description}" class="variable-highlight">${innerText.trim()}</span>`; 
  });

  return content;
}

// --- NEW Helper Function: Extract Variable Names from HTML ---
function extractVariableNamesFromHtml(htmlContent: string): string[] {
  const variableNames = new Set<string>();
  // Regex to find <span data-variable-name="NAME" ...>
  // It captures the value of data-variable-name
  const regex = /<span[^>]*data-variable-name="([^"]+)"[^>]*>/g;
  let match;
  while ((match = regex.exec(htmlContent)) !== null) {
    if (match[1]) { // match[1] is the captured group (the variable name)
      variableNames.add(match[1].trim());
    }
  }
  console.log('Extracted variable names:', Array.from(variableNames));
  return Array.from(variableNames);
}

// --- Main Handler ---
serve(async (req: Request) => {
  // Log every request method and headers for debugging
  console.log('Incoming request:', req.method, 'Headers:', Object.fromEntries(req.headers.entries()));

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    // Return 200 OK for preflight, with CORS headers
    return new Response(null, { headers: corsHeaders, status: 200 }); 
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

    // 4. Construct Prompt for AI (Updated)
    const systemPrompt = `You are an AI assistant specialized in drafting legal document templates. Your goal is to generate a high-quality, reusable template based on user instructions.

IMPORTANT INSTRUCTIONS:
1.  Analyze the user\'s request and the specified category (${category}).
2.  Generate a suitable, concise name for this template.
3.  Generate the template content as valid HTML suitable for a rich text editor.
4.  **CRITICAL: Identify all placeholders or variable fields (e.g., names, dates, specific amounts, addresses). For each placeholder:**
    *   **Determine a clear, descriptive name (e.g., "Client Full Name", "Effective Date", "Agreement Amount").**
    *   **Write a brief description for the placeholder (e.g., "The full legal name of the client.", "The date the agreement becomes effective.", "The primary monetary amount of the agreement.").**
    *   **Format the placeholder STRICTLY as: <span data-variable-name="Placeholder Name" data-variable-description="Placeholder Description" class="variable-highlight">Placeholder Name</span>.**
    *   **The class attribute "variable-highlight" MUST be included.**
    *   **Do NOT use brackets [], curly braces {{}}, or any other format.**
    *   Example Correct: <span data-variable-name="Client Full Name" data-variable-description="The full legal name of the client." class="variable-highlight">Client Full Name</span>
    *   Example Correct: <span data-variable-name="Effective Date" data-variable-description="The date the agreement becomes effective." class="variable-highlight">Effective Date</span>
5.  Structure the output as a JSON object with two keys: "templateName" (string) and "templateContent" (string containing the full HTML template with <span...> placeholders).
6.  Ensure the HTML content is well-formed and ready to be inserted into an editor. Use standard HTML tags like <p>, <h1>, <ul>, etc. appropriately.
7.  Do not include explanations or introductions outside the JSON structure.`;

    const userPrompt = `User Instructions: ${instructions}`;

    console.log('Sending request to OpenAI model:', AI_MODEL);

    // 5. Call OpenAI API
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

    // 6. Parse AI Response
    let generatedName;
    let generatedContent;
    let extractedVariables;
    try {
      const parsedResult = JSON.parse(aiResultContent);
      if (typeof parsedResult.templateName !== 'string' || typeof parsedResult.templateContent !== 'string') {
        throw new Error('AI response JSON did not contain valid templateName or templateContent strings.');
      }
      generatedName = sanitizeName(parsedResult.templateName);
      generatedContent = parsedResult.templateContent; // Get raw content first

      // 7. Post-process AI content to ensure correct format
      generatedContent = ensureSpanFormat(generatedContent); 
      // --- End Post-processing ---

      // --- Extract variables AFTER ensuring format ---
      extractedVariables = extractVariableNamesFromHtml(generatedContent);
      // --- End variable extraction ---

      if (!generatedName) generatedName = `${category} Template (Generated)`; 
      if (!generatedContent) throw new Error('AI generated empty template content.');

      console.log(`AI generated template: Name="${generatedName}"`);
    } catch (parseError) {
      console.error('Failed to parse JSON response from AI:', parseError);
      console.error('Raw AI content:', aiResultContent); // Log raw content for debugging
      throw new Error(`AI did not return valid JSON: ${parseError.message}`);
    }
    if (!extractedVariables) extractedVariables = [];

    // 8. Save to Database (Updated: ADDED 'variables' field)
    console.log(`Attempting to save template \"${generatedName}\" to database with variables:`, extractedVariables);
    const { data: dbData, error: dbError } = await supabaseAdmin
      .from('document_templates')
      .insert({
        name: generatedName,
        description: `AI-generated based on instructions: "${instructions.substring(0, 100)}..."`, 
        category: category.toLowerCase(),
        content: generatedContent, // Save the processed HTML content
        variables: extractedVariables, // ADDED: Save the extracted variable names
        tags: ['ai-generated'], 
        user_id: userId,
        is_public: false, 
      })
      .select('id') 
      .single(); 

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