import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "./cors.ts";
import { OpenAI } from "https://deno.land/x/openai@v4.48.2/mod.ts"; // Use Deno module

console.log("Generate-inline-text: Function script starting...");

let openai: OpenAI;
try {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  console.log(`Generate-inline-text: Read OPENAI_API_KEY. Is defined? ${!!apiKey}`);
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set.");
  }
  openai = new OpenAI({ apiKey });
  console.log("Generate-inline-text: OpenAI client initialized successfully.");
} catch (initError) {
  console.error("Generate-inline-text: FATAL ERROR initializing OpenAI client:", initError);
}

serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    const payload = await req.json();
    // selectedText is optional, instructions are key for generation
    const { selectedText, instructions, surroundingContext, stream = true } = payload;

    if (!instructions) {
      return new Response(JSON.stringify({
        error: "Missing required parameter: instructions"
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 400
      });
    }

    // --- Construct Prompts for Inline Generation --- 
    // System prompt instructs the AI on how to behave for inline generation.
    // It emphasizes sticking to the user's direct instruction and integrating smoothly.
    const systemPrompt = `You are an expert AI writing assistant integrated directly into a text editor.
Your primary goal is to follow the user's instructions to generate or modify text seamlessly within their document.

IMPORTANT RULES:
1. Generate text that directly addresses the user's instructions. 
2. If 'Selected Text' is provided, use it as the primary subject of the instruction (e.g., rewrite it, expand on it, answer a question about it) unless the instruction clearly indicates otherwise.
3. If no 'Selected Text' is provided, generate new text based on the instruction, suitable for insertion at the user's cursor position.
4. Use the 'Surrounding Context' to understand the style, tone, and subject matter of the document, ensuring your generation is consistent and fits naturally.
5. Maintain the original core legal meaning and context if the instruction implies modification of existing legal text, unless explicitly told to change it.
6. Use standard Markdown for formatting ONLY where appropriate (e.g., **bold**, *italic* for emphasis). DO NOT use HTML tags.
7. Ensure proper paragraph structure. Use double line breaks (\n\n) to separate paragraphs if generating multi-paragraph content.
8. Return ONLY the generated text. Do not include any introductory phrases, explanations, apologies, or conversational filler (e.g., "Okay, here is...", "Certainly, I can help with..."). Just output the result directly as if you are completing the user's thought or command within the editor.`;

    let userMessageContent = `User Instruction: "${instructions}"`;

    if (selectedText) {
      userMessageContent += `\n\nSelected Text (to operate on or use as direct context for the instruction):
--- SELECTED TEXT START ---
${selectedText}
--- SELECTED TEXT END ---`;
    }

    if (surroundingContext) {
      userMessageContent += `\n\nSurrounding Context (for style, tone, and broader subject matter):
--- CONTEXT START ---
${surroundingContext}
--- CONTEXT END ---`;
    }
    
    userMessageContent += "\n\nBased on the above, provide ONLY the generated text as per the system prompt rules.";

    const apiPayload = {
      model: "gpt-4o", // Or a faster model if latency is critical and quality is sufficient
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
      temperature: 0.6, // Allow for a bit more creativity than pure rewrite
      // max_tokens: 1024, // Consider setting a max_tokens limit for inline generation
    };

    if (stream) {
      console.log(`Generate-inline-text: Generating stream response for instruction: "${instructions.substring(0,50)}..."`);
      // console.log(`Generate-inline-text: Calling OpenAI with payload:`, JSON.stringify(apiPayload, null, 2)); 
      
      let openaiStream;
      try {
        openaiStream = await openai.chat.completions.create({
          ...apiPayload,
          stream: true
        });
        console.log(`Generate-inline-text: OpenAI stream object created successfully.`);
      } catch (openaiError) {
        console.error(`Generate-inline-text: ERROR calling OpenAI:`, openaiError);
        throw openaiError; 
      }

      const responseStream = new ReadableStream({
        async start(controller) {
          console.log(`Generate-inline-text: ReadableStream started.`);
          const encoder = new TextEncoder();
          try {
            let chunkCounter = 0;
            for await (const chunk of openaiStream) {
              chunkCounter++;
              const content = chunk.choices[0]?.delta?.content || '';
              if (content) {
                const sseChunk = `data: ${JSON.stringify(content)}\n\n`;
                controller.enqueue(encoder.encode(sseChunk));
              }
            }
            console.log(`Generate-inline-text: Stream loop finished after ${chunkCounter} chunks.`);
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            console.log(`Generate-inline-text: ReadableStream closed normally.`);
          } catch (streamError) {
            console.error(`Generate-inline-text: ERROR INSIDE OpenAI stream processing:`, streamError, JSON.stringify(streamError));
            controller.error(streamError);
          }
        }
      });

      return new Response(responseStream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache", 
        }
      });
    } else {
      // Non-streaming Logic (kept for completeness, but inline generation should ideally stream)
      console.log(`Generate-inline-text: Generating non-stream response for instruction: "${instructions.substring(0,50)}..."`);
      const response = await openai.chat.completions.create({
        ...apiPayload,
        stream: false
      });
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('OpenAI returned empty content for generate-inline-text.');
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
    console.error("Error in MAIN CATCH generate-inline-text function:", error, JSON.stringify(error));
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