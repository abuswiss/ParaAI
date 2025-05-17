import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "./cors.ts";
import { OpenAI } from "https://deno.land/x/openai@v4.48.2/mod.ts"; // Use Deno module

console.log("Rewrite-text: Function script starting...");

let openai: OpenAI;
try {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  console.log(`Rewrite-text: Read OPENAI_API_KEY. Is defined? ${!!apiKey}`);
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set.");
  }
  openai = new OpenAI({ apiKey });
  console.log("Rewrite-text: OpenAI client initialized successfully.");
} catch (initError) {
  console.error("Rewrite-text: FATAL ERROR initializing OpenAI client:", initError);
  // We can't proceed without the client, so maybe throw to prevent serve?
  // Or let serve handle it, but it might still cause boot issues.
  // For now, log and let serve potentially fail later.
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
    let systemPrompt = `You are an expert legal writing assistant tasked with rewriting text according to specific instructions. 
IMPORTANT RULES:
1. Rewrite the provided text precisely as instructed in the user message.
2. Maintain the original core legal meaning and context unless explicitly told otherwise.
3. Use standard Markdown for formatting ONLY where appropriate for clarity or emphasis (e.g., **bold**, *italic*). DO NOT use HTML tags like <strong>.
4. Ensure proper paragraph structure. Use double line breaks to separate paragraphs.
5. Return ONLY the rewritten text. Do not include any introductory phrases, explanations, apologies, or conversational filler before or after the rewritten content. Just output the result directly.`;
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
      console.log(`Rewrite (${mode}): Calling OpenAI with payload:`, JSON.stringify(apiPayload, null, 2)); // Log the exact payload
      
      let openaiStream;
      try {
        openaiStream = await openai.chat.completions.create({
          ...apiPayload,
          stream: true
        });
        console.log(`Rewrite (${mode}): OpenAI stream object created successfully.`);
      } catch (openaiError) {
        console.error(`Rewrite (${mode}): ERROR calling OpenAI:`, openaiError);
        throw openaiError; // Rethrow to be caught by the main try/catch
      }

      // CORRECTED Streaming Logic:
      const responseStream = new ReadableStream({
        async start(controller) {
          console.log(`Rewrite (${mode}): ReadableStream started.`);
          const encoder = new TextEncoder();
          try {
            let chunkCounter = 0;
            for await (const chunk of openaiStream) {
              chunkCounter++;
              const content = chunk.choices[0]?.delta?.content || '';
              // console.log(`Rewrite (${mode}): Received chunk ${chunkCounter}, content: ${content.length > 0 ? content.substring(0, 50) + '...' : ''}`); // Optional verbose chunk logging
              if (content) {
                // Format as Server-Sent Event
                const sseChunk = `data: ${JSON.stringify(content)}\n\n`;
                // console.log(`Rewrite (${mode}): Enqueuing chunk ${chunkCounter}: ${sseChunk.trim()}`); // Log before enqueue
                controller.enqueue(encoder.encode(sseChunk));
              }
            }
            console.log(`Rewrite (${mode}): Stream loop finished after ${chunkCounter} chunks.`);
            // Signal stream completion
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            console.log(`Rewrite (${mode}): ReadableStream closed normally.`);
          } catch (streamError) {
            console.error(`Rewrite (${mode}): ERROR INSIDE OpenAI stream processing:`, streamError, JSON.stringify(streamError));
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