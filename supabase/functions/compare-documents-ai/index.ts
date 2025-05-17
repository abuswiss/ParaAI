import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "./cors.ts";
import { OpenAI } from "https://deno.land/x/openai@v4.48.2/mod.ts";
import { createSupabaseAdminClient } from "../_shared/supabaseAdmin.ts";

console.log("Compare-Documents-AI: Function script starting...");

// Initialize OpenAI client (ensure OPENAI_API_KEY is set in Supabase Function env vars)
let openai: OpenAI;
try {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  console.log(`Compare-Documents-AI: Read OPENAI_API_KEY. Is defined? ${!!apiKey}`);
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set.");
  }
  openai = new OpenAI({ apiKey });
  console.log("Compare-Documents-AI: OpenAI client initialized successfully.");
} catch (initError) {
  console.error("Compare-Documents-AI: FATAL ERROR initializing OpenAI client:", initError);
  // If OpenAI init fails, the function won't work.
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Ensure OpenAI client is available
    if (!openai) {
       throw new Error("OpenAI client failed to initialize. Check API key.");
    }

    // Parse request body
    const { text1, text2, goal, userId } = await req.json();

    if (!userId || typeof userId !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid userId' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Validate input
    if (typeof text1 !== 'string' || typeof text2 !== 'string') {
      return new Response(JSON.stringify({ error: "Missing or invalid text1 or text2 in request body" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    
    // Validate goal (optional, but if provided, should be a string)
    if (goal !== undefined && typeof goal !== 'string') {
      return new Response(JSON.stringify({ error: "Invalid 'goal' parameter: must be a string if provided." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const goalProvided = goal && goal.trim() !== "";

    const supabaseAdmin = createSupabaseAdminClient();
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('subscription_status, trial_ends_at, trial_ai_calls_used')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return new Response(JSON.stringify({ error: 'User profile not found' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const TRIAL_AI_CALL_LIMIT = 30;
    const now = new Date();
    if (profile.subscription_status === 'trialing') {
      if (!profile.trial_ends_at || new Date(profile.trial_ends_at) < now) {
        return new Response(JSON.stringify({ error: 'Trial expired' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        });
      }
      if ((profile.trial_ai_calls_used ?? 0) >= TRIAL_AI_CALL_LIMIT) {
        return new Response(JSON.stringify({ error: 'Trial call limit reached' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        });
      }
    } else if (profile.subscription_status !== 'active') {
      return new Response(JSON.stringify({ error: 'Subscription inactive' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // --- Construct Comparison Prompt --- 
    const systemPrompt = `You are an expert legal AI assistant specializing in document comparison.
Your task is to analyze two versions of a text (TEXT 1 and TEXT 2).
You must return a JSON object with two top-level keys: "summary" and "focusedDifferences".

1.  "summary": A concise overall summary of the key differences between the two texts.
    Focus on identifying substantial changes, additions, deletions, and modifications in meaning or substance.
    Ignore minor formatting changes unless they significantly alter readability or structure.
    Present the summary as a single, coherent paragraph. Do not use bullet points or list format for the summary field.

2.  "focusedDifferences": An array of JSON objects, where each object details a specific difference found.
    ${goalProvided 
        ? `THE USER HAS A SPECIFIC GOAL FOR THIS COMPARISON: "${goal.trim()}". Prioritize differences MOST RELEVANT to this goal in the "focusedDifferences" array. If no differences directly relate to the goal, this array can be empty.`
        : 'If no specific goal is provided, identify the most significant differences.'
    }
    Each object in the "focusedDifferences" array must have the following keys:
    -   "area": (string) A brief category or description of what aspect the difference relates to (e.g., "Payment Deadline", "Liability Clause", "Event Timeline").
    -   "originalSnippet": (string) The relevant text snippet from TEXT 1. This snippet should be concise and directly related to the identified difference. If the difference is an addition, this might be an empty string or a very short contextual snippet.
    -   "modifiedSnippet": (string) The corresponding text snippet from TEXT 2 showing the change. This snippet should be concise. If the difference is a deletion, this might be an empty string or a very short contextual snippet.
    -   "observation": (string) Your brief explanation of the difference, inconsistency, or change.

Example of a "focusedDifference" object:
{
  "area": "Payment Terms",
  "originalSnippet": "The payment is due within 30 days.",
  "modifiedSnippet": "The payment is due within 15 days of invoice receipt.",
  "observation": "The payment due date has been shortened from 30 days to 15 days and specified as from invoice receipt."
}

If no specific differences are found for "focusedDifferences" (especially if a goal is provided and no relevant changes are found), return an empty array for "focusedDifferences", but still provide an overall "summary".
Ensure your entire response is a single, valid JSON object. Do not include any text outside of this JSON object.
`;

    let userPrompt = `Analyze the differences between TEXT 1 and TEXT 2.`;
    if (goalProvided) {
      userPrompt += ` Pay special attention to aspects related to: "${goal.trim()}".`;
    }
    userPrompt += `

--- TEXT 1 (Original) START ---
${text1}
--- TEXT 1 (Original) END ---

--- TEXT 2 (Modified) START ---
${text2}
--- TEXT 2 (Modified) END ---

Return your analysis as a JSON object with "summary" and "focusedDifferences" keys, according to the system prompt instructions.`;

    console.log("Compare-Documents-AI: Sending request to OpenAI with goal:", goal || "General comparison", " Expecting JSON object.");

    const response = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2, // Slightly lower for more precise JSON generation
      max_tokens: 1500, // Increased to accommodate potentially larger JSON output
      response_format: { type: "json_object" }, // Enable JSON mode
    });

    console.log("Compare-Documents-AI: Received response from OpenAI.");

    const rawResponseContent = response.choices[0]?.message?.content;

    if (!rawResponseContent) {
      throw new Error('OpenAI returned empty content.');
    }

    console.log("Compare-Documents-AI: Raw AI response:", rawResponseContent);

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(rawResponseContent);
    } catch (parseError) {
      console.error("Compare-Documents-AI: Failed to parse AI response as JSON:", parseError);
      throw new Error(`AI returned invalid JSON. Raw output: ${rawResponseContent}`);
    }

    // Validate the structure of the parsed response
    if (typeof parsedResponse.summary !== 'string' || !Array.isArray(parsedResponse.focusedDifferences)) {
        console.error("Compare-Documents-AI: AI response missing required fields 'summary' (string) or 'focusedDifferences' (array). Response:", parsedResponse);
        throw new Error("AI response was valid JSON but missed required fields: 'summary' (must be string) and 'focusedDifferences' (must be an array).");
    }
    
    // Optional: Further validation for items within focusedDifferences
    if (parsedResponse.focusedDifferences.length > 0) {
        const firstDiff = parsedResponse.focusedDifferences[0];
        if (typeof firstDiff.area !== 'string' || 
            typeof firstDiff.originalSnippet !== 'string' ||
            typeof firstDiff.modifiedSnippet !== 'string' ||
            typeof firstDiff.observation !== 'string') {
            console.warn("Compare-Documents-AI: First item in 'focusedDifferences' might be missing expected string fields. Please verify structure.", firstDiff);
            // Not throwing an error here, but logging a warning. Could be made stricter.
        }
    }

    if (profile.subscription_status === 'trialing') {
      await supabaseAdmin
        .from('profiles')
        .update({ trial_ai_calls_used: (profile.trial_ai_calls_used ?? 0) + 1 })
        .eq('id', userId);
    }

    return new Response(JSON.stringify(parsedResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Compare-Documents-AI: Error in main function handler:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    // Ensure CORS headers are included in error responses too
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500, // Use 500 for server-side errors
    });
  }
});

console.log("Compare-Documents-AI: Function script finished loading."); 