import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { OpenAI } from "https://deno.land/x/openai@v4.48.2/mod.ts"; // Use Deno module

// Ensure OPENAI_API_KEY is set in Supabase Function settings
const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY")
});

serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    const payload = await req.json();
    // Default stream to true, mode to 'improve' if not provided
    const { textToRewrite, instructions, surroundingContext, mode = 'improve', stream = true } = payload;
    if (!textToRewrite) {
      return new Response(JSON.stringify({
        error: "Missing textToRewrite"
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 400
      });
    }
    // --- Construct Prompts based on Mode --- 
    let systemPrompt = `You are an expert legal writing assistant. Rewrite the following text as instructed. Maintain the original core legal meaning and context unless specified otherwise. Adapt the style and length according to the user's request. IMPORTANT: Use HTML <strong> tags for bold text instead of markdown asterisks.`;
    let userInstructionPrefix = "Rewrite the following text";
    switch(mode){
      case 'shorten':
        userInstructionPrefix = "Rewrite the following text to be concise and significantly shorter while preserving the key legal points and meaning.";
        break;
      case 'expand':
        userInstructionPrefix = "Expand on the following text, elaborating on the details or providing further clarification while maintaining the original core idea.";
        break;
      case 'professional':
        userInstructionPrefix = "Rewrite the following text using a clear, professional legal tone suitable for communication with colleagues or clients, ensuring precision and avoiding jargon where possible unless necessary.";
        break;
      case 'formal':
        userInstructionPrefix = "Rewrite the following text using a strictly formal legal tone, avoiding contractions and colloquialisms, and employing precise legal terminology.";
        break;
      case 'simple':
        userInstructionPrefix = "Rewrite the following text using plain, simple language suitable for a non-legal audience, retaining the essential legal meaning but avoiding complex terms.";
        break;
      case 'improve':
        userInstructionPrefix = "Rewrite the following text to improve its clarity, conciseness, grammar, sentence structure, and overall readability while preserving the core legal meaning.";
        break;
      case 'custom':
        // Use provided instructions if mode is custom
        if (instructions) {
          userInstructionPrefix = instructions;
        } else {
          // Default custom to improve if no instructions
          userInstructionPrefix = "Rewrite the following text to improve its clarity, conciseness, grammar, sentence structure, and overall readability while preserving the core legal meaning.";
        }
        break;
      default:
        // Default to improve if mode is unrecognized
        userInstructionPrefix = "Rewrite the following text to improve its clarity, conciseness, grammar, sentence structure, and overall readability while preserving the core legal meaning.";
        break;
    }
    // Add general instructions if provided and mode wasn't 'custom' already using them
    if (instructions && mode !== 'custom') {
      userInstructionPrefix += `\n\nAdditional Instructions: ${instructions}`;
    }
    let userMessageContent = `${userInstructionPrefix}:
--- TEXT START ---
${textToRewrite}
--- TEXT END ---`;
    if (surroundingContext) {
      userMessageContent += `\n\nFor context, here is the text surrounding the selection:
--- CONTEXT START ---
${surroundingContext}
--- CONTEXT END ---`;
    }
    const apiPayload = {
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userMessageContent
        }
      ],
      temperature: 0.5
    };
    if (stream) {
      // Streaming Logic
      console.log(`Rewrite (${mode}): Generating stream response...`);
      const openaiStream = await openai.chat.completions.create({
        ...apiPayload,
        stream: true
      });
      console.log('Rewrite: OpenAI stream object created.');

      // CORRECTED Streaming Logic:
      const responseStream = new ReadableStream({
        async start(controller) {
          console.log('Rewrite: ReadableStream started.');
          const encoder = new TextEncoder();
          try {
            let chunkCounter = 0;
            for await (const chunk of openaiStream) {
              chunkCounter++;
              const content = chunk.choices[0]?.delta?.content || '';
              if (content) {
                // Format as Server-Sent Event
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(content)}\n\n`));
              }
            }
            console.log(`Rewrite: Stream loop finished after ${chunkCounter} chunks.`);
            // Signal stream completion
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            console.log('Rewrite: ReadableStream closed normally.');
          } catch (streamError) {
            console.error('Error INSIDE OpenAI stream for rewrite-text:', streamError, JSON.stringify(streamError));
            // Try to send an error message through the stream if possible?
            // Or just log and close/error
            controller.error(streamError);
          }
        }
      });

      return new Response(responseStream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache", // Recommended for SSE
        }
      });
    } else {
      // Non-streaming Logic
      console.log(`Rewrite (${mode}): Generating non-stream response...`);
      const response = await openai.chat.completions.create({
        ...apiPayload,
        stream: false
      });
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('OpenAI returned empty content.');
      }
      return new Response(JSON.stringify({
        result: content
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 200
      });
    }
  } catch (error) {
    console.error("Error in MAIN CATCH rewrite-text function:", error, JSON.stringify(error));
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 500
    });
  }
}); 