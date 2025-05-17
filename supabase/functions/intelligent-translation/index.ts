import { serve } from "std/http/server";
import { OpenAI } from "openai";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Intelligent Translation function initializing...");

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

interface TranslationRequestBody {
  text_to_translate: string;
  target_language: string;
  source_language?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const requestBody: TranslationRequestBody = await req.json();
    const { text_to_translate, target_language, source_language } = requestBody;

    if (!text_to_translate || !target_language) {
      return new Response(
        JSON.stringify({ error: "Missing text_to_translate or target_language" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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