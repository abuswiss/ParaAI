import { serve } from "std/http/server";
import { OpenAI } from "openai";
import { corsHeaders } from "../_shared/cors.ts";
import { createSupabaseAdminClient } from "../_shared/supabaseAdmin.ts";

console.log("Intelligent Translation function initializing...");

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

interface TranslationRequestBody {
  text_to_translate: string;
  target_language: string;
  source_language?: string;
  userId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const requestBody: TranslationRequestBody = await req.json();
    const { text_to_translate, target_language, source_language, userId } = requestBody;

    if (!text_to_translate || !target_language || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing text_to_translate, target_language, or userId" }),
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
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const TRIAL_AI_CALL_LIMIT = 30;
    const now = new Date();

    if (profile.subscription_status === 'trialing') {
      if (!profile.trial_ends_at || new Date(profile.trial_ends_at) < now) {
        return new Response(
          JSON.stringify({ error: 'Trial expired' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if ((profile.trial_ai_calls_used ?? 0) >= TRIAL_AI_CALL_LIMIT) {
        return new Response(
          JSON.stringify({ error: 'Trial call limit reached' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (profile.subscription_status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Subscription inactive' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Simplified prompt construction
    let promptContent = `"${text_to_translate}"`;
    let instruction = "";

    if (source_language) {
      instruction = `Translate the following text from ${source_language} to ${target_language}:\n\n`;
    } else {
      instruction = `Detect the language and translate the following text to ${target_language}:\n\n`;
    }
    const fullPrompt = instruction + promptContent;
    

    const chatCompletion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful translation assistant." },
        { role: "user", content: fullPrompt }, // Use the concatenated prompt
      ],
      model: "gpt-3.5-turbo", // Or consider gpt-4o for better quality/cost balance
      temperature: 0.3,
    });

    const translated_text = chatCompletion.choices[0].message.content?.trim();
    // Potentially, OpenAI might include source language detection in its response or we might infer it.
    // For now, we're not explicitly returning detected_source_language unless the model provides it.

    if (!translated_text) {
        throw new Error("Failed to get translation from OpenAI");
    }

    if (profile.subscription_status === 'trialing') {
      await supabaseAdmin
        .from('profiles')
        .update({ trial_ai_calls_used: (profile.trial_ai_calls_used ?? 0) + 1 })
        .eq('id', userId);
    }

    return new Response(
      JSON.stringify({ translated_text }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in intelligent-translation function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}); 