import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { Anthropic } from 'npm:@anthropic-ai/sdk@0.22.0'; // Use a recent compatible version
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@^2.39.0'; // Use a recent compatible version


// Initialize Supabase admin client for user authentication (optional but good practice)
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  throw new Error('Supabase environment variables are not set for function.');
}
const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);


// Get Anthropic API Key
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
if (!anthropicApiKey) {
  console.error('ANTHROPIC_API_KEY is not set in environment variables.');
  throw new Error('AI service configuration error: ANTHROPIC_API_KEY not set.');
}

const anthropic = new Anthropic({
  apiKey: anthropicApiKey,
});

interface RequestPayload {
  prompt: string;
  model?: string; // Optional: e.g., claude-3-haiku-20240307
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Authorization (optional, but recommended if this is a protected endpoint)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('Auth error:', userError?.message);
      return new Response(JSON.stringify({ error: userError?.message || 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    console.log(`User ${user.id} invoking generate-field-suggestion`);

    // 2. Validate Request Method & Body
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { 
      prompt,
      model = 'claude-3-haiku-20240307' // Default to a fast and cost-effective model
    }: RequestPayload = await req.json();

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Missing or invalid 'prompt' in request body." }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // 3. Construct System Prompt for AI (Tailor this for field suggestions)
    const systemPrompt = `You are an AI assistant helping a user fill out a form or template. 
    Based on the provided context (which includes the template's purpose, other filled fields, and the specific field in question), 
    provide a concise and relevant suggestion for the current field. 
    The suggestion should be a direct value for the field, not a conversational response. 
    Keep it brief and to the point. If context implies a specific format (e.g., a date, a name), try to adhere to it.
    Do NOT include explanations or apologies if you cannot make a perfect suggestion. Simply provide the best possible suggestion based on the input.`;

    // 4. Call Anthropic API
    console.log(`Calling AI model (${model}) for field suggestion. Prompt starts with: "${prompt.substring(0,100)}..."`)
    const claudeResponse = await anthropic.messages.create({
        model: model,
        max_tokens: 150, // Keep suggestions relatively short
        system: systemPrompt,
        messages: [
            { role: "user", content: prompt }
        ],
        temperature: 0.5, // Moderate temperature for some creativity but still grounded
    });

    if (!claudeResponse || !claudeResponse.content || !claudeResponse.content[0] || !claudeResponse.content[0].text) {
      console.error('Invalid response structure from AI API:', claudeResponse);
      throw new Error('Invalid response structure from AI API.');
    }
    
    const suggestion = claudeResponse.content[0].text.trim();

    console.log(`AI suggestion received: "${suggestion.substring(0,100)}..."`);

    // 5. Return the suggestion
    return new Response(JSON.stringify({ suggestion: suggestion }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in generate-field-suggestion function:', error, error.stack);
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
}); 