import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { OpenAI } from "https://deno.land/x/openai@v4.48.2/mod.ts"; // Use Deno module
import { createSupabaseAdminClient } from '../_shared/supabaseAdmin.ts';

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
    const supabaseAdmin = createSupabaseAdminClient();
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      const msg = userError?.message || 'Invalid token';
      console.error('Auth Error:', msg);
      return new Response(JSON.stringify({ error: msg }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    const userId = user.id;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('subscription_status, trial_ends_at, trial_ai_calls_used')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return new Response(JSON.stringify({ error: 'User profile not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403
      });
    }

    const TRIAL_AI_CALL_LIMIT = 30;
    const now = new Date();

    if (profile.subscription_status === 'trialing') {
      if (!profile.trial_ends_at || new Date(profile.trial_ends_at) < now) {
        return new Response(JSON.stringify({ error: 'Trial expired' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
        });
      }
      if ((profile.trial_ai_calls_used ?? 0) >= TRIAL_AI_CALL_LIMIT) {
        return new Response(JSON.stringify({ error: 'Trial call limit reached' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
        });
      }
    } else if (profile.subscription_status !== 'active') {
      return new Response(JSON.stringify({ error: 'Subscription inactive' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403
      });
    }

    const payload = await req.json();
    const { textToSummarize, instructions, surroundingContext, stream = true } = payload; // Default stream to true
    if (!textToSummarize) {
      return new Response(JSON.stringify({
        error: "Missing textToSummarize"
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 400
      });
    }
    const systemPrompt = `You are an expert legal writing assistant. Summarize the following text accurately and concisely, focusing on the key legal points and conclusions. IMPORTANT: Use HTML <strong> tags for bold text instead of markdown asterisks where appropriate for emphasis.`;
    let userMessageContent = `Summarize the following text:
--- TEXT START ---
${textToSummarize}
--- TEXT END ---`;
    if (instructions) {
      userMessageContent += `\n\nInstructions: ${instructions}`;
    }
    if (surroundingContext) {
      userMessageContent += `\n\nFor context, here is the text surrounding the selection:
--- CONTEXT START ---
${surroundingContext}
--- CONTEXT END ---`;
    }
    if (stream) {
      // Existing streaming logic
      console.log('Summarize: Generating stream response...');
      const openaiStream = await openai.chat.completions.create({
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
        stream: true,
        temperature: 0.3
      });

      // CORRECTED Streaming Logic:
      const responseStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          try {
            for await (const chunk of openaiStream) {
              const content = chunk.choices[0]?.delta?.content || '';
              if (content) {
                // Format as Server-Sent Event
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(content)}\n\n`));
              }
            }
            // Signal stream completion
            if (profile.subscription_status === 'trialing') {
              await supabaseAdmin
                .from('profiles')
                .update({ trial_ai_calls_used: (profile.trial_ai_calls_used ?? 0) + 1 })
                .eq('id', userId);
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (streamError) {
            console.error('Error during OpenAI stream for summarize-text:', streamError);
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
      // Non-streaming logic
      console.log('Summarize: Generating non-stream response...');
      const response = await openai.chat.completions.create({
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
        stream: false,
        temperature: 0.3
      });
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('OpenAI returned empty content.');
      }
      if (profile.subscription_status === 'trialing') {
        await supabaseAdmin
          .from('profiles')
          .update({ trial_ai_calls_used: (profile.trial_ai_calls_used ?? 0) + 1 })
          .eq('id', userId);
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
    console.error("Error in summarize-text function:", error);
    // Ensure error response is JSON
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