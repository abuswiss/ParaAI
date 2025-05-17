import { serve } from "std/http/server";
import { OpenAI } from "openai";
import { corsHeaders } from "../_shared/cors.ts";
import { createSupabaseAdminClient } from "../_shared/supabaseAdmin.ts";

console.log("Intelligent Drafting function initializing...");

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

interface DraftingRequestBody {
  draft_type: string; // e.g., "email", "client_portal_message", "text_message", "event_description"
  prompt_details: string;
  document_context?: string;
  tone?: string; // e.g., "formal", "casual", "empathetic"
  length_preference?: string; // e.g., "short", "medium", "long"
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const requestBody: DraftingRequestBody & { userId?: string } = await req.json();
    const { draft_type, prompt_details, document_context, tone, length_preference, userId } = requestBody;

    if (!draft_type || !prompt_details || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing draft_type, prompt_details, or userId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('subscription_status, trial_ends_at, trial_ai_calls_used')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return new Response(JSON.stringify({ error: 'User profile not found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const TRIAL_AI_CALL_LIMIT = 30;
    const now = new Date();

    if (profile.subscription_status === 'trialing') {
      if (!profile.trial_ends_at || new Date(profile.trial_ends_at) < now) {
        return new Response(JSON.stringify({ error: 'Trial expired' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if ((profile.trial_ai_calls_used ?? 0) >= TRIAL_AI_CALL_LIMIT) {
        return new Response(JSON.stringify({ error: 'Trial call limit reached' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else if (profile.subscription_status !== 'active') {
      return new Response(JSON.stringify({ error: 'Subscription inactive' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let systemMessage = "You are an AI assistant for a legal professional. Your drafts should be clear, concise, and professionally appropriate.";
    
    let userPrompt = "Generate a first draft for a " + draft_type + ".\n";
    userPrompt += "Key points to convey: \"" + prompt_details + "\".\n";

    if (document_context) {
      userPrompt += "Consider the following context from a document: \"" + document_context + "\".\n";
    }
    if (tone) {
      userPrompt += "The tone should be " + tone + ".\n";
    }
    if (length_preference) {
      userPrompt += "The desired length is " + length_preference + ".\n";
    }

    const chatCompletion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userPrompt },
      ],
      model: "gpt-4o", // Using a more advanced model for drafting quality
      temperature: 0.7, // Slightly higher temperature for more creative drafts
    });

    const draft_suggestion = chatCompletion.choices[0].message.content?.trim();

    if (!draft_suggestion) {
        throw new Error("Failed to get draft suggestion from OpenAI");
    }

    if (profile.subscription_status === 'trialing') {
      await supabaseAdmin
        .from('profiles')
        .update({ trial_ai_calls_used: (profile.trial_ai_calls_used ?? 0) + 1 })
        .eq('id', userId);
    }

    return new Response(
      JSON.stringify({ draft_suggestion }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in intelligent-drafting function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}); 