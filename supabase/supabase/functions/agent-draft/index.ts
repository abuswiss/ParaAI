import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { OpenAI } from 'https://deno.land/x/openai/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Function to get Supabase client (respecting user auth)
function getSupabaseClient(req) {
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: {
      headers: {
        Authorization: req.headers.get('Authorization')
      }
    }
  });
}

serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    const body = await req.json();
    const { instructions, caseId, documentContext, analysisContext, userId } = body;

    if (!instructions || !userId) {
      throw new Error('Missing instructions or userId');
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) throw new Error('OPENAI_API_KEY not set.');

    console.log(`Agent Draft Function: Case ${caseId || 'N/A'}`);

    // 1. Build Prompt
    let contextPrompt = '';
    if (documentContext) {
      contextPrompt += `Relevant document context:\n${documentContext}\n\n`;
    }
    if (analysisContext) {
      contextPrompt += `Relevant analysis context:\n${analysisContext}\n\n`;
    }

    const systemPrompt = 'You are a paralegal AI assistant. Draft legal documents, emails, or letters as instructed. Use any provided context. Be clear, professional, and legally accurate. Use HTML <strong> tags for bold text instead of markdown asterisks.';
    const userPrompt = `${contextPrompt}Drafting instructions: ${instructions}`;

    // 2. Call OpenAI with streaming
    const openai = new OpenAI({
      apiKey: openaiApiKey
    });
    const openaiStream = await openai.chat.completions.create({
      model: 'gpt-4', // Consider gpt-4o-mini for speed/cost if sufficient
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: true,
      temperature: 0.3
    });

    // 3. Return the stream
    const stream = new ReadableStream({
      async start (controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of openaiStream){
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(content)}\n\n`));
            }
          }
          // Signal end of stream
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (streamError) {
          console.error('Error during OpenAI stream for agent-draft:', streamError);
          controller.error(streamError);
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache'
      },
      status: 200
    });

  } catch (error) {
    console.error('Error in Agent Draft Function:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}); 