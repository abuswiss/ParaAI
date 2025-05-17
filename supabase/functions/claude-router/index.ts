import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@^2.0.0';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2.0.0';
import { v4 as uuidv4 } from "npm:uuid";
import Anthropic from 'npm:@anthropic-ai/sdk@0.19.0';
import type { MessageParam } from 'npm:@anthropic-ai/sdk';

// --- Database Interaction Types ---
interface DbConversation {
  id: string;
  title?: string;
  case_id: string;
  owner_id: string;
  created_at?: string;
  updated_at?: string;
}

interface DbMessage {
  id: string;
  conversation_id: string;
  owner_id: string;
  role: 'system' | 'user' | 'assistant' | 'error';
  content: string;
  model?: string;
  metadata?: Record<string, any> | null;
  created_at?: string;
}

// Define the shape for preloadedContext
interface PreloadedContextShape {
  analysisItem: string;
  analysisType: string;
  documentText: string; // Full text of the parent document, may or may not be used if doc IDs are primary
}

// Request body interface
interface ClaudeRouterRequestBody {
  messages: { role: 'system' | 'user' | 'assistant'; content: string; id?: string }[];
  caseId?: string;
  conversationId?: string;
  documentContextIds?: string[];
  activeDocumentId?: string;
  preloadedContext?: PreloadedContextShape; // Changed type to PreloadedContextShape
  query?: string; // For direct query classification
  streamThoughts?: boolean;
}

// Source info for research results
interface SourceInfo {
  title: string;
  url: string;
  date?: string;
  snippet?: string;
}

// Configuration Constants
const MAX_TOTAL_TOKENS_APPROX = 16000; // Keep overall limit
const MAX_CONTEXT_TOKENS_APPROX = 8000; // Example: Max tokens for document context alone

// Helper to roughly estimate token count
function estimateTokens(text: string | null | undefined): number {
  return Math.ceil((text || '').length / 3.5);
}

// Enhanced legal citation detection function
function extractLegalCitations(text) {
  const citations = [];
  let match;
  
  // US case law citations (federal and state formats)
  const caseRegexPatterns = [
    // Standard case format: Brown v. Board of Education, 347 U.S. 483 (1954)
    /([A-Za-z\s\.']+)\s+v\.\s+([A-Za-z\s\.']+),?\s+(\d+)\s+([A-Za-z\.]+)\s+(\d+)(?:\s+\((\d{4})\))?/g,
    
    // Short form case citation: Roe, 410 U.S. at 113
    /([A-Za-z\s\.']+),\s+(\d+)\s+([A-Za-z\.]+)\s+at\s+(\d+)/g,
    
    // State reporter citation: Smith v. Jones, 123 N.Y.2d 456 (2010)
    /([A-Za-z\s\.']+)\s+v\.\s+([A-Za-z\s\.']+),?\s+(\d+)\s+([A-Za-z\.]+\d*[a-z]*)\s+(\d+)(?:\s+\((\d{4})\))?/g,
    
    // UK/Commonwealth case format: R v Smith [2020] UKSC 1
    /([A-Za-z\s\.']+)\s+v\s+([A-Za-z\s\.']+)\s+\[(\d{4})\]\s+([A-Za-z]+)\s+(\d+)/g,
  ];
  
  // US Statutes and codes
  const statuteRegexPatterns = [
    // US Code: 18 U.S.C. § 1030
    /(\d+)\s+([A-Za-z\.]+)\s+[§\s]+(\d+[A-Za-z0-9\-\.]*)/g,
    
    // CFR: 17 C.F.R. § 240.10b-5
    /(\d+)\s+C\.F\.R\.\s+[§\s]+(\d+\.\d+[A-Za-z0-9\-\.]*)/g,
    
    // Public Law: Pub. L. No. 116-283, 134 Stat. 3388 (2021)
    /Pub\.\s+L\.\s+No\.\s+(\d+)-(\d+),\s+(\d+)\s+Stat\.\s+(\d+)(?:\s+\((\d{4})\))?/g,
    
    // State codes: Cal. Penal Code § 422
    /([A-Za-z\.]+)\s+([A-Za-z\.]+)\s+Code\s+[§\s]+(\d+[A-Za-z0-9\-\.]*)/g,
  ];
  
  // Regulations and administrative materials
  const regulationRegexPatterns = [
    // Federal Register: 87 Fed. Reg. 12345 (Mar. 1, 2022)
    /(\d+)\s+Fed\.\s+Reg\.\s+(\d+)(?:\s+\(([A-Za-z\.]+\s+\d+,\s+\d{4})\))?/g,
    
    // Administrative decisions: In re Smith, 123 B.N.A. 456 (NLRB 2010)
    /In\s+re\s+([A-Za-z\s\.']+),\s+(\d+)\s+([A-Za-z\.]+)\s+(\d+)(?:\s+\(([A-Za-z]+)\s+(\d{4})\))?/g,
  ];
  
  // Process each regex pattern group
  const processRegexPatterns = (patterns, type, processFn) => {
    patterns.forEach(regex => {
      let match;
      while ((match = regex.exec(text)) !== null) {
        const citation = processFn(match);
        if (citation) {
          citations.push({...citation, type, full: match[0]});
        }
      }
    });
  };
  
  // Process case citations
  processRegexPatterns(caseRegexPatterns, 'case', (match) => {
    // Different processing depending on the pattern matched
    if (match[0].includes(' v. ')) {
      return {
        plaintiff: match[1]?.trim(),
        defendant: match[2]?.trim(),
        volume: match[3],
        reporter: match[4],
        page: match[5],
        year: match[6] || null
      };
    } else if (match[0].includes(' v ') && match[0].includes('[')) { // UK format
      return {
        plaintiff: match[1]?.trim(),
        defendant: match[2]?.trim(),
        year: match[3],
        court: match[4],
        number: match[5]
      };
    } else { // Short form
      return {
        case: match[1]?.trim(),
        volume: match[2],
        reporter: match[3],
        page: match[4]
      };
    }
  });
  
  // Process statute citations
  processRegexPatterns(statuteRegexPatterns, 'statute', (match) => {
    if (match[0].includes('U.S.C.')) { // US Code
      return {
        title: match[1],
        code: match[2],
        section: match[3]
      };
    } else if (match[0].includes('C.F.R.')) { // CFR
      return {
        title: match[1],
        section: match[2]
      };
    } else if (match[0].includes('Pub. L.')) { // Public Law
      return {
        congress: match[1],
        law: match[2],
        statVol: match[3],
        statPage: match[4],
        year: match[5] || null
      };
    } else { // State codes
      return {
        state: match[1],
        codeType: match[2],
        section: match[3]
      };
    }
  });
  
  // Process regulation citations
  processRegexPatterns(regulationRegexPatterns, 'regulation', (match) => {
    if (match[0].includes('Fed. Reg.')) { // Federal Register
      return {
        volume: match[1],
        page: match[2],
        date: match[3] || null
      };
    } else if (match[0].includes('In re')) { // Administrative decisions
      return {
        party: match[1]?.trim(),
        volume: match[2],
        reporter: match[3],
        page: match[4],
        agency: match[5] || null,
        year: match[6] || null
      };
    }
  });
  
  return citations;
}

// Citation verification with Perplexity
async function verifyCitationWithPerplexity(citation) {
  try {
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_TOKEN');
    if (!perplexityApiKey) {
      return { 
        citation: citation.full,
        verified: false,
        error: 'Perplexity API token not available'
      };
    }
    
    let prompt = `Verify this legal citation: ${citation.full}`;
    
    // Add specific instructions based on citation type
    if (citation.type === 'case') {
      prompt += `\n\nPlease provide: 
1. The correct full citation 
2. The court that decided it
3. The date of the decision
4. A 1-2 sentence summary of the holding/significance`;
    } else if (citation.type === 'statute') {
      prompt += `\n\nPlease provide:
1. The correct full citation
2. Whether this is current law
3. When it was enacted/last amended
4. A brief description of what this section covers`;
    } else if (citation.type === 'regulation') {
      prompt += `\n\nPlease provide:
1. The correct full citation
2. The agency that issued it
3. When it was published/effective
4. What it regulates`;
    }
    
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${perplexityApiKey}`
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: "You are a legal research specialist focusing on accurate verification of legal citations, cases, and statutes. Provide precise information with proper legal citations. When verifying a case, include the full citation, court, date, and a brief holding."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        options: {
          "search_focus": "internet"
        },
        // Prefer legal sources
        search_domain_filter: ["law.cornell.edu", "scholar.google.com", "courtlistener.com", "justia.com", "oyez.org", "leagle.com", "casetext.com", "findlaw.com"],
        web_search_options: {
          search_context_size: "high"  // For comprehensive legal search
        },
        temperature: 0.1, // Lower temperature for factual accuracy
        max_tokens: 500,
        // Use structured output
        response_format: {
          type: "json_schema",
          json_schema: {
            schema: {
              type: "object",
              properties: {
                verified: { type: "boolean" },
                correctedCitation: { type: "string" },
                court: { type: "string" },
                date: { type: "string" },
                summary: { type: "string" },
                sources: { 
                  type: "array",
                  items: { 
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      url: { type: "string" }
                    }
                  }
                }
              },
              required: ["verified"]
            }
          }
        }
      })
    });
    
    if (perplexityResponse.ok) {
      const data = await perplexityResponse.json();
      if (data.choices?.[0]?.message?.content) {
        try {
          const verificationData = JSON.parse(data.choices[0].message.content);
          return {
            citation: citation.full,
            ...verificationData
          };
        } catch (parseError) {
          return {
            citation: citation.full,
            verified: false,
            error: 'Could not parse verification data'
          };
        }
      }
    }
    
    return {
      citation: citation.full,
      verified: false,
      error: 'Failed to get verification from Perplexity'
    };
  } catch (error) {
    console.error('Citation verification error:', error);
    return {
      citation: citation.full,
      verified: false,
      error: error.message
    };
  }
}

// Format verification results for display
function formatVerificationResults(results) {
  if (!results.length) return null;
  
  let summary = '### Citation Verification\n\n';
  
  for (const result of results) {
    if (result.verified) {
      summary += `✅ **${result.citation}** - Verified correct\n`;
      if (result.summary) {
        summary += `> ${result.summary}\n`;
      }
    } else if (result.correctedCitation) {
      summary += `⚠️ **${result.citation}** - Correction: ${result.correctedCitation}\n`;
      if (result.summary) {
        summary += `> ${result.summary}\n`;
      }
    } else {
      summary += `❓ **${result.citation}** - Could not verify\n`;
    }
    
    if (result.sources && result.sources.length) {
      summary += '\nSources:\n';
      for (const source of result.sources.slice(0, 2)) {
        summary += `- [${source.title}](${source.url})\n`;
      }
    }
    
    summary += '\n---\n\n';
  }
  
  return summary;
}

console.log('Claude Router function initializing...');

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  global: { headers: { Authorization: `Bearer ${supabaseServiceKey}` } },
  auth: { persistSession: false }
});

// Add Anthropic API key
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY') || '';
if (!anthropicApiKey) {
  console.error('Missing ANTHROPIC_API_KEY');
}

const anthropic = new Anthropic({
  apiKey: anthropicApiKey,
});

// Import type declarations for Deno
type DenoReadableStream<T> = ReadableStream<T>;

// --- Query Classification Function ---
async function classifyQuery(query: string): Promise<'simple' | 'complex' | 'research_needed'> {
  try {
    console.log('Classifying query with Claude 3.5 Haiku');
    
    // Detect likely research queries with simple heuristics first
    const researchKeywords = [
      'recent case', 'recent ruling', 'current law', 'latest regulation',
      'new legislation', 'current statute', 'latest precedent', 'search for',
      'find cases', 'research on', 'look up', 'latest developments',
      '2023', '2024', '2025', // Recent years
    ];
    
    // Check for research keywords
    for (const keyword of researchKeywords) {
      if (query.toLowerCase().includes(keyword.toLowerCase())) {
        console.log(`Research keyword detected: "${keyword}". Classifying as research_needed`);
        return 'research_needed';
      }
    }
    
    // Increased context and more specific instructions for model
    const classification = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      system: `You are a specialized query classifier for a legal assistant system. Your only job is to categorize legal questions into one of three types:

1. 'simple' - Basic definitional questions, procedural information, or straightforward legal concepts that don't require nuanced analysis.
2. 'complex' - Questions requiring legal analysis, strategy, risk assessment, interpretation of laws, or hypothetical scenarios.
3. 'research_needed' - Questions about current laws, recent cases, jurisdiction-specific details, or that require citing specific statutes.

You MUST return ONLY a valid JSON object with the format: {"queryType": "TYPE"} where TYPE is one of: "simple", "complex", or "research_needed".`,
      messages: [{ role: "user", content: `Classify this legal query: "${query}"` }],
      max_tokens: 150,
      temperature: 0.1
    });
    
    const classificationText = classification.content[0].text;
    console.log('Classification response:', classificationText);
    
    // First try direct JSON parsing
    try {
      const classificationJson = JSON.parse(classificationText);
      if (classificationJson.queryType && ['simple', 'complex', 'research_needed'].includes(classificationJson.queryType)) {
        console.log(`Successfully classified query as: ${classificationJson.queryType}`);
        return classificationJson.queryType as 'simple' | 'complex' | 'research_needed';
      }
    } catch (e) {
      console.error('Error parsing classification JSON:', e);
      // Try more aggressive regex fallback
      const typeMatch = classificationText.match(/["']queryType["']\s*:\s*["']([^"']+)["']/);
      if (typeMatch && ['simple', 'complex', 'research_needed'].includes(typeMatch[1])) {
        console.log(`Extracted query type from text: ${typeMatch[1]}`);
        return typeMatch[1] as 'simple' | 'complex' | 'research_needed';
      }
      
      // Try another fallback - direct keyword matching
      if (classificationText.includes('complex')) {
        console.log('Keyword fallback detected "complex"');
        return 'complex';
      } else if (classificationText.includes('research')) {
        console.log('Keyword fallback detected "research_needed"');
        return 'research_needed';
      }
    }
    
    // Default to complex if parsing fails - better to err on the side of more capability
    console.warn('Classification parsing failed, defaulting to "complex"');
    return 'complex';
  } catch (error) {
    console.error('Error in query classification:', error);
    // Default to complex on error - better user experience than simple
    return 'complex';
  }
}

// --- Simple Query Handler (Claude 3.5 Sonnet with Thinking Capability) ---
async function handleSimpleQuery(
  query: string,
  messages: MessageParam[],
  documentContext = '',
  streamThoughts = false,
  preloadedContextSnippet?: string // Added for the specific snippet
): Promise<DenoReadableStream<Uint8Array>> {
  console.log('--- handleSimpleQuery called ---');
  console.log('streamThoughts parameter value:', streamThoughts);
  const model = streamThoughts ? "claude-3-7-sonnet-20250219" : "claude-3-5-haiku-20241022";
  console.log(`Selected model: ${model}, thinking enabled: ${streamThoughts}, temperature: ${streamThoughts && model.includes("claude-3-7") ? 1 : 0.3}`);
  
  // Format messages for Claude
  const formattedMessages: MessageParam[] = messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.content
  }));
  
  // Create a system prompt with any document context
  let systemPrompt = `You are a legal assistant providing clear, concise answers to simple legal questions. Be direct and to the point.
  
Respond in a professional, authoritative tone suitable for legal professionals.
  
When answering questions:
1. Provide definitions and explanations in plain language
2. Include relevant legal citations when appropriate
3. Be precise and accurate in your responses
4. If you're uncertain about specific jurisdictional details, acknowledge this
5. Format your responses with appropriate markdown for readability

If you mention a specific, publicly accessible legal document, statute, or well-known legal information resource online (and you are confident about its URL), please provide a markdown link: \`[Resource Name](URL)\`. This is only if you are using your general knowledge and the source is unambiguous and widely recognized.
If you are referencing information directly from the document context provided by the user, clearly state this. For example: "Based on the provided document context..." or "According to the context you provided...".`;
  
  if (preloadedContextSnippet) {
    systemPrompt += `\n\nIMPORTANT FOCUSED CONTEXT: The user has highlighted the following snippet: "${preloadedContextSnippet}". Please give this special attention in your response.`;
  }

  if (documentContext) {
    systemPrompt += "\n\nReference these documents in your response if relevant:\n";
    systemPrompt += documentContext;
  }
  
  // Create a stream transformer to handle Claude streaming
  const transformer = new TransformStream();
  const writer = transformer.writable.getWriter();
  
  // Start the stream with proper Claude model
  const stream = await anthropic.messages.create({
    model: model,
    system: systemPrompt,
    messages: [
      ...formattedMessages,
      { role: "user", content: query }
    ],
    max_tokens: 4000,
    temperature: streamThoughts ? 1.0 : 0.3,
    stream: true,
    thinking: streamThoughts ? { type: "enabled", budget_tokens: 1500 } : undefined
  });
  
  let chunkCount = 0;
  let thinkingBuffer = '';
  let lastThinkingSent = Date.now();
  
  // Process the stream
  (async () => {
    try {
      // Send metadata event first
      const metadataEvent = {
        type: 'metadata',
        responseType: 'simple',
        model: streamThoughts ? 'claude-3-7-sonnet-20250219' : 'claude-3-5-haiku-20241022'
      };
      await writer.write(encoder.encode(`data: ${JSON.stringify(metadataEvent)}\n\n`));
      
      for await (const chunk of stream) {
        if (chunkCount < 3) {
          console.log('Raw chunk:', JSON.stringify(chunk));
          chunkCount++;
        }

        if (chunk.type === "content_block_delta" && chunk.delta.type === "thinking_delta") {
          if (chunk.delta.thinking && streamThoughts) {
            thinkingBuffer += chunk.delta.thinking;
            // Send when we hit a natural break or enough time/length has passed
            if (
              thinkingBuffer.endsWith('.') ||
              thinkingBuffer.endsWith('\n') ||
              thinkingBuffer.length > 100 ||
              Date.now() - lastThinkingSent > 1000
            ) {
              await writer.write(encoder.encode(`data: ${JSON.stringify({
                type: 'thought',
                content: thinkingBuffer.trim()
              })}\n\n`));
              thinkingBuffer = '';
              lastThinkingSent = Date.now();
            }
          }
        } else if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          // This is an answer content chunk
          if (chunk.delta.text) { // Ensure text exists
            await writer.write(encoder.encode(`data: ${JSON.stringify({ 
              type: 'answer', 
              content: chunk.delta.text 
            })}\n\n`));
          }
        } else if (chunk.type === "message_start") {
          // Optional: log message start if needed
           console.log('Raw chunk (message_start):', JSON.stringify(chunk));
        } else if (chunk.type === "content_block_start" && chunk.content_block.type === "thinking") {
           // Optional: log start of a thinking block if needed
           console.log('Raw chunk (content_block_start for thinking):', JSON.stringify(chunk));
        } else if (chunk.type === "content_block_start" && chunk.content_block.type === "text") {
          // Optional: log start of a text (answer) block if needed
          console.log('Raw chunk (content_block_start for text):', JSON.stringify(chunk));
        } else if (chunk.type === "message_stop") {
          await writer.write(encoder.encode(`data: ${JSON.stringify({ 
            type: 'complete' 
          })}\n\n`));
        }
      }
      // Flush any remaining buffer before closing
      if (thinkingBuffer.trim()) {
        await writer.write(encoder.encode(`data: ${JSON.stringify({
          type: 'thought',
          content: thinkingBuffer.trim()
        })}\n\n`));
      }
    } catch (error) {
      console.error('Stream processing error:', error);
      await writer.write(encoder.encode(`data: ${JSON.stringify({ 
        type: 'error',
        error: `Error processing stream: ${error.message}`
      })}\n\n`));
    } finally {
      await writer.close();
    }
  })();
  
  return transformer.readable;
}

// --- Complex Query Handler (Claude 3.7 + Thinking) ---
async function handleComplexQuery(
  query: string,
  messages: MessageParam[],
  documentContext = '',
  streamThoughts = true,
  preloadedContextSnippet?: string // Added for the specific snippet
): Promise<DenoReadableStream<Uint8Array>> {
  console.log('--- handleComplexQuery called ---');
  console.log('streamThoughts parameter value:', streamThoughts);
  const model = "claude-3-7-sonnet-20250219";
  console.log(`Selected model: ${model}, thinking enabled: ${streamThoughts}, temperature: ${streamThoughts ? 1 : 0.2}`);
  
  // Build a comprehensive legal system prompt
  let systemPrompt = `You are a sophisticated legal assistant with expertise in contract analysis, case law, and regulatory compliance.
  
When analyzing legal questions:
1. Identify the relevant legal principles and applicable laws
2. Apply appropriate precedent and case law
3. Consider jurisdictional differences and conflicts of law
4. Highlight risks, uncertainties, and alternative interpretations
5. Provide practical recommendations with appropriate disclaimers

Show your thorough legal reasoning process step-by-step.

Structure your responses with clear headings and use markdown formatting to enhance readability.

If you mention a specific, publicly accessible legal document, statute, or well-known legal information resource online (and you are confident about its URL), please provide a markdown link: \`[Resource Name](URL)\`. This is only if you are using your general knowledge and the source is unambiguous and widely recognized.
If you are referencing information directly from the document context provided by the user, clearly state this. For example: "Based on the provided document context..." or "According to the context you provided...".`;
  
  if (preloadedContextSnippet) {
    systemPrompt += `\n\nIMPORTANT FOCUSED CONTEXT: The user has highlighted the following snippet: "${preloadedContextSnippet}". Please give this special attention in your response.`;
  }

  if (documentContext) {
    systemPrompt += "\n\nAnalyze these legal documents:\n";
    systemPrompt += documentContext;
  }
  
  // Create a stream transformer
  const transformer = new TransformStream();
  const writer = transformer.writable.getWriter();
  
  // Start the stream with Claude 3.7 with extended thinking
  const stream = await anthropic.messages.create({
    model: model,
    system: systemPrompt,
    messages: messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    })),
    max_tokens: 7000,
    temperature: streamThoughts ? 1.0 : 0.2,
    stream: true,
    thinking: streamThoughts ? { type: "enabled", budget_tokens: 3000 } : undefined
  });
  
  let chunkCount = 0;
  let thinkingBuffer = '';
  let lastThinkingSent = Date.now();
  
  // Process the stream
  (async () => {
    try {
      // Send metadata event first
      const metadataEvent = {
        type: 'metadata',
        responseType: 'complex',
        model: 'claude-3-7-sonnet-20250219'
      };
      await writer.write(encoder.encode(`data: ${JSON.stringify(metadataEvent)}\n\n`));
      
      for await (const chunk of stream) {
        if (chunkCount < 3) {
          console.log('Raw chunk:', JSON.stringify(chunk));
          chunkCount++;
        }

        if (chunk.type === "content_block_delta" && chunk.delta.type === "thinking_delta") {
          if (chunk.delta.thinking && streamThoughts) {
            thinkingBuffer += chunk.delta.thinking;
            // Send when we hit a natural break or enough time/length has passed
            if (
              thinkingBuffer.endsWith('.') ||
              thinkingBuffer.endsWith('\n') ||
              thinkingBuffer.length > 100 ||
              Date.now() - lastThinkingSent > 1000
            ) {
              await writer.write(encoder.encode(`data: ${JSON.stringify({
                type: 'thought',
                content: thinkingBuffer.trim()
              })}\n\n`));
              thinkingBuffer = '';
              lastThinkingSent = Date.now();
            }
          }
        } else if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          // This is an answer content chunk
          if (chunk.delta.text) { // Ensure text exists
            await writer.write(encoder.encode(`data: ${JSON.stringify({ 
              type: 'answer', 
              content: chunk.delta.text 
            })}\n\n`));
          }
        } else if (chunk.type === "message_start") {
          // Optional: log message start if needed
           console.log('Raw chunk (message_start):', JSON.stringify(chunk));
        } else if (chunk.type === "content_block_start" && chunk.content_block.type === "thinking") {
           // Optional: log start of a thinking block if needed
           console.log('Raw chunk (content_block_start for thinking):', JSON.stringify(chunk));
        } else if (chunk.type === "content_block_start" && chunk.content_block.type === "text") {
          // Optional: log start of a text (answer) block if needed
          console.log('Raw chunk (content_block_start for text):', JSON.stringify(chunk));
        } else if (chunk.type === "message_stop") {
          await writer.write(encoder.encode(`data: ${JSON.stringify({ 
            type: 'complete' 
          })}\n\n`));
        }
      }
      // Flush any remaining buffer before closing
      if (thinkingBuffer.trim()) {
        await writer.write(encoder.encode(`data: ${JSON.stringify({
          type: 'thought',
          content: thinkingBuffer.trim()
        })}\n\n`));
      }
    } catch (error) {
      console.error('Stream processing error:', error);
      await writer.write(encoder.encode(`data: ${JSON.stringify({ 
        type: 'error',
        error: 'Error processing stream: ' + error.message
      })}\n\n`));
    } finally {
      await writer.close();
    }
  })();
  
  return transformer.readable;
}

// --- Research Query Handler (Claude 3.7 + Web Search) ---
async function handleResearchQuery(
  query: string,
  messages: MessageParam[],
  documentContext = '',
  streamThoughts = true,
  preloadedContextSnippet?: string // Added for the specific snippet
): Promise<DenoReadableStream<Uint8Array>> {
  console.log('--- handleResearchQuery called ---');
  console.log('streamThoughts parameter value:', streamThoughts);
  const model = "claude-3-7-sonnet-20250219";
  console.log(`Selected model: ${model}, thinking enabled: ${streamThoughts}, temperature: ${streamThoughts ? 1 : 0.3}`);
  
  // First perform a web search
  console.log('Performing legal research search for query:', query);
  const searchResults: SourceInfo[] = [];
  try {
    // Use Perplexity API if available
    const perplexityApiToken = Deno.env.get('PERPLEXITY_API_TOKEN');
    console.log('Perplexity API token available:', !!perplexityApiToken);
    
    if (perplexityApiToken) {
      // Enhanced Perplexity configuration for legal research
      const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${perplexityApiToken}`
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            {
              role: "system",
              content: "You are a specialized legal research assistant. Focus on finding accurate, up-to-date legal information from authoritative sources. When researching legal topics, prioritize current statutes, recent case law, and official legal resources. Cite your sources properly with full citations."
            },
            {
              role: "user",
              content: `Research this legal question thoroughly: ${query}`
            }
          ],
          options: {
            "search_focus": "internet"
          },
          search_domain_filter: ["law.cornell.edu", "scholar.google.com", "oyez.org", "justia.com", "courtlistener.com", "findlaw.com", "casetext.com", "leagle.com"],
          web_search_options: {
            search_context_size: "high"  // For comprehensive legal search
          },
          temperature: 0.2,  // Lower temperature for factual accuracy
          max_tokens: 2000
        })
      });
      
      if (perplexityResponse.ok) {
        const data = await perplexityResponse.json();
        console.log('Perplexity API response received');
        console.log('Perplexity raw context data:', JSON.stringify(data.choices?.[0]?.message?.context, null, 2));
        
        // Extract search results from the response
        if (data.choices?.[0]?.message?.content) {
          // Add the main response as a source
          searchResults.push({
            title: "Perplexity Legal Research",
            url: "https://www.perplexity.ai/",
            date: new Date().toISOString(),
            snippet: data.choices[0].message.content
          });
          
          // Extract cited sources if available
          if (data.choices[0].message.context?.citations) {
            const citations = data.choices[0].message.context.citations;
            for (const citation of citations) {
              if (citation.title && citation.url) {
                searchResults.push({
                  title: citation.title,
                  url: citation.url,
                  date: citation.publishedDate || 'Unknown',
                  snippet: citation.snippet || undefined
                });
              }
            }
          }
        }
      } else {
        const errorText = await perplexityResponse.text();
        console.error('Perplexity API error:', errorText);
        throw new Error(`Perplexity API error: ${errorText}`);
      }
    } else {
      throw new Error('Perplexity API token not available in environment variables');
    }
  } catch (searchError) {
    console.error('Error with web search:', searchError);
    searchResults.push({
      title: "Search Error",
      url: "N/A", 
      date: new Date().toISOString(),
      snippet: "Unable to retrieve search results. Analysis will continue with available information."
    });
  }
  
  // Format search results for Claude
  const formattedResults = searchResults.map(result => 
    `Source: ${result.title} (${result.url})
     Date: ${result.date || 'Unknown'}
     Excerpt: ${result.snippet}
    `
  ).join('\n\n');
  
  // Build a research-oriented system prompt
  const systemPrompt = `You are a senior legal research analyst. Your task is to synthesize the provided search results and any attached document context to answer the user's query comprehensively.

**Search Results Provided:**
The user's query has been researched, and the following information snippets and source URLs were found:
${formattedResults}

**Critical Instructions for Citing Sources in Your Synthesized Answer:**
1.  When you incorporate information from a specific source URL found in the 'Search Results Provided', you **MUST** cite it directly in your response.
2.  Format the citation as a markdown link: \`[Descriptive Title of Source](URL)\`. Use the title provided in the search results if available, otherwise create a concise descriptive title.
3.  Provide this markdown link the *first time* you substantively use information from that specific source URL or when it's most relevant.
4.  **Do NOT use numeric citations like [1] or [Source 1]. Use only direct markdown links as described.**
5.  Ensure all URLs are fully qualified.
6.  If the search results themselves already contain markdown links from a previous AI step, you may integrate them directly if they are accurate and well-placed. If a search result provides a URL but not a markdown link, create the markdown link.

**Response Structure and Content:**
- Structure your response with clear headings, lists, and use markdown formatting.
- Clearly distinguish between established law and emerging legal trends.
- If information may not be current or complete, state this.
- Consider jurisdictional limitations.
- Indicate when additional research might be necessary.
- When you use information *specifically from the document context provided by the user* (which will be included below if available), clearly state this by saying, for example, "According to the provided context..." or "Based on the document context you provided...". If you are also using an external source for the same point, cite that as well using the markdown link format.

Example of desired citation format if referring to a source from the provided results:
"Based on recent findings, [Example Case Update from CourtListener](https://www.courtlistener.com/example-case), the interpretation has shifted."

Please provide a detailed and well-cited answer.`;
  
  // For research, preloaded context might be better integrated into the query itself or as part of the document context
  // For now, let's consider how to best add it. It could be part of the initial query to Perplexity if that's used.
  // Or appended to the user's queryContent for Claude.

  // Create a stream transformer
  const transformer = new TransformStream();
  const writer = transformer.writable.getWriter();
  
  // Prepare messages with context
  let contextEnhancedQuery = `${query}\n\nResearch Results:\n${formattedResults}`;
  if (documentContext) {
    contextEnhancedQuery = `${contextEnhancedQuery}\n\nDocument Context:\n${documentContext}`;
  }
  if (preloadedContextSnippet) { // Adding snippet to the enhanced query for research
    contextEnhancedQuery = `Regarding the specific snippet: "${preloadedContextSnippet}"\n\n${contextEnhancedQuery}`;
  }
  
  // Format previous messages
  const formattedMessages = messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.content
  }));
  
  // Start the stream with Claude 3.7 with thinking
  const stream = await anthropic.messages.create({
    model: model,
    system: systemPrompt,
    messages: [
      ...formattedMessages,
      { role: "user", content: contextEnhancedQuery }
    ],
    max_tokens: 7000,
    temperature: streamThoughts ? 1.0 : 0.3,
    stream: true,
    thinking: streamThoughts ? { type: "enabled", budget_tokens: 3000 } : undefined
  });
  
  let chunkCount = 0;
  let thinkingBuffer = '';
  let lastThinkingSent = Date.now();
  
  // Process the stream
  (async () => {
    try {
      // Send metadata event first with sources
      const metadataEvent = {
        type: 'metadata',
        responseType: 'research',
        model: 'claude-3-7-sonnet-20250219',
        sources: searchResults.map((r) => ({
          title: r.title,
          url: r.url,
          date: r.date
        }))
      };
      await writer.write(encoder.encode(`data: ${JSON.stringify(metadataEvent)}\n\n`));
      
      for await (const chunk of stream) {
        if (chunkCount < 3) {
          console.log('Raw chunk:', JSON.stringify(chunk));
          chunkCount++;
        }

        if (chunk.type === "content_block_delta" && chunk.delta.type === "thinking_delta") {
          if (chunk.delta.thinking && streamThoughts) {
            thinkingBuffer += chunk.delta.thinking;
            // Send when we hit a natural break or enough time/length has passed
            if (
              thinkingBuffer.endsWith('.') ||
              thinkingBuffer.endsWith('\n') ||
              thinkingBuffer.length > 100 ||
              Date.now() - lastThinkingSent > 1000
            ) {
              await writer.write(encoder.encode(`data: ${JSON.stringify({
                type: 'thought',
                content: thinkingBuffer.trim()
              })}\n\n`));
              thinkingBuffer = '';
              lastThinkingSent = Date.now();
            }
          }
        } else if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          // This is an answer content chunk
          if (chunk.delta.text) { // Ensure text exists
            await writer.write(encoder.encode(`data: ${JSON.stringify({ 
              type: 'answer', 
              content: chunk.delta.text 
            })}\n\n`));
          }
        } else if (chunk.type === "message_start") {
          // Optional: log message start if needed
           console.log('Raw chunk (message_start):', JSON.stringify(chunk));
        } else if (chunk.type === "content_block_start" && chunk.content_block.type === "thinking") {
           // Optional: log start of a thinking block if needed
           console.log('Raw chunk (content_block_start for thinking):', JSON.stringify(chunk));
        } else if (chunk.type === "content_block_start" && chunk.content_block.type === "text") {
          // Optional: log start of a text (answer) block if needed
          console.log('Raw chunk (content_block_start for text):', JSON.stringify(chunk));
        } else if (chunk.type === "message_stop") {
          await writer.write(encoder.encode(`data: ${JSON.stringify({ 
            type: 'complete' 
          })}\n\n`));
        }
      }
      // Flush any remaining buffer before closing
      if (thinkingBuffer.trim()) {
        await writer.write(encoder.encode(`data: ${JSON.stringify({
          type: 'thought',
          content: thinkingBuffer.trim()
        })}\n\n`));
      }
    } catch (error) {
      console.error('Stream processing error:', error);
      await writer.write(encoder.encode(`data: ${JSON.stringify({ 
        type: 'error',
        error: 'Error processing stream: ' + error.message
      })}\n\n`));
    } finally {
      await writer.close();
    }
  })();
  
  return transformer.readable;
}

// --- Text encoder for streaming ---
const encoder = new TextEncoder();

// --- Main Serve Function ---
serve(async (req: Request) => {
  // --- CORS Handling ---
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let newConversationId: string | null = null;

  try {
    // --- Authorization ---
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      console.warn('Missing Authorization header');
      return new Response(JSON.stringify({ error: 'Missing authorization token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    // Use admin client to validate token and get user
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      const errorMessage = userError?.message || 'User not found for token';
      console.error('Auth Error:', errorMessage);
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const userId = user.id;
    console.log('User authenticated:', userId);

    // --- Request Body Parsing ---
    const {
      messages,
      caseId,
      conversationId: conversationIdFromRequest,
      documentContextIds,
      activeDocumentId,
      preloadedContext, // This is now PreloadedContextShape | undefined
      query: directQuery,
      streamThoughts = false,
    }: ClaudeRouterRequestBody = await req.json();

    console.log(`Request: user=${userId}, msgs=${messages?.length || 0}, case=${caseId}, conv=${conversationIdFromRequest}, ctxIds=${documentContextIds?.length || 0}`);
    if (preloadedContext) {
      console.log(`Preloaded Context Snippet: Type: ${preloadedContext.analysisType}, Item: ${(preloadedContext.analysisItem || "").substring(0,100)}...`);
    }

    // Determine the query content - either from direct query or last message
    let queryContent = directQuery || '';
    if (!queryContent && messages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === 'user') {
        queryContent = lastMessage.content;
      }
    }

    if (!queryContent) {
      return new Response(JSON.stringify({ error: 'No query provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- Conversation Management ---
    let conversationId: string | null = conversationIdFromRequest || null;
    let conversation: DbConversation | null = null;

    if (conversationId) {
      // Fetch existing conversation
      const { data: convData, error: convError } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .maybeSingle();

      if (convError) {
        console.error(`Error fetching conversation ${conversationId}:`, convError);
        return new Response(JSON.stringify({ error: 'Failed to retrieve conversation details' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      if (!convData) {
        console.warn(`Conversation ${conversationId} not found. Clearing ID to potentially create new.`);
        conversationId = null;
      } else if (convData.owner_id !== userId) {
        console.error(`User ${userId} attempted to access conversation ${conversationId} owned by ${convData.owner_id}`);
        return new Response(JSON.stringify({ error: 'Access denied to conversation' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        conversation = convData as DbConversation;
        console.log(`Using existing conversation: ${conversationId}`);
      }
    }

    // Create new conversation if needed and case ID exists
    if (!conversationId && caseId) {
      const firstUserMessageContent = queryContent.substring(0, 50);
      const title = `Chat: ${firstUserMessageContent}...`;
      const newConvData: Partial<DbConversation> = {
        title: title,
        case_id: caseId,
        owner_id: userId,
      };
      
      const { data: createData, error: createError } = await supabaseAdmin
        .from('conversations')
        .insert(newConvData)
        .select()
        .single();

      if (createError || !createData) {
        console.error('Error creating conversation:', createError);
        return new Response(JSON.stringify({ error: 'Failed to create conversation' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      conversation = createData as DbConversation;
      conversationId = conversation.id;
      newConversationId = conversation.id;
      console.log(`Created new conversation ${conversationId} for case ${caseId}`);
    }

    // Save user message if we have a conversation
    if (conversationId && queryContent) {
      // Create user message object
      const userMessage = {
        id: uuidv4(),
        conversation_id: conversationId,
        role: 'user' as const,
        content: queryContent,
        owner_id: userId,
        // Store document context in metadata
        metadata: {
          document_context: documentContextIds?.length ? documentContextIds.join(',') : undefined,
          // Optionally store preloaded context type/item here too for record keeping
          preloaded_analysis_type: preloadedContext?.analysisType,
          preloaded_analysis_item_snippet: preloadedContext?.analysisItem?.substring(0, 200) // Store a snippet
        },
      };
      
      const { error: messageError } = await supabaseAdmin
        .from('messages')
        .insert(userMessage);

      if (messageError) {
        console.error('Error saving user message:', messageError);
        // Continue despite error, but log it
      }
    }

    // --- Document Context Retrieval ---
    let fetchedContextText = '';
    if (documentContextIds && documentContextIds.length > 0 && caseId) {
      console.log(`Fetching context for ${documentContextIds.length} document(s) in case ${caseId}`);
      try {
        const { data: docsData, error: docsError } = await supabaseAdmin
          .from('documents')
          .select('id, filename, extracted_text, case_id')
          .in('id', documentContextIds)
          .eq('case_id', caseId);

        if (docsError) {
          throw docsError;
        }

        if (docsData && docsData.length > 0) {
          console.log(`Found ${docsData.length} documents`);
          
          // Build context from document texts
          fetchedContextText = docsData.map(doc => {
            const docText = doc.extracted_text || '';
            // Truncate very long documents to avoid token limits
            const truncatedText = docText.length > 5000 
              ? docText.substring(0, 5000) + '... [document truncated due to length]' 
              : docText;
            
            return `--- Document: ${doc.filename} (ID: ${doc.id}) ---\n${truncatedText}\n\n`;
          }).join('\n');
        } else {
          console.warn(`No documents found for IDs: ${documentContextIds.join(', ')}`);
          fetchedContextText = "\n\n[No document context available]\n";
        }
      } catch (docError) {
        console.error('Error fetching document context:', docError);
        fetchedContextText = "\n\n[Error fetching document context]\n";
      }
    }

    // --- Query Classification and Routing ---
    
    // Extract the specific snippet text to pass to handlers
    const specificSnippetText = preloadedContext?.analysisItem;

    // Check for explicit search requests first
    const searchTerms = ['search the web', 'search for', 'look up', 'find information', 'search online', 'web search', 'internet search'];
    let forceResearch = false;
    
    for (const term of searchTerms) {
      if (queryContent.toLowerCase().includes(term.toLowerCase())) {
        console.log(`Explicit search request detected: "${term}". Forcing research mode.`);
        forceResearch = true;
        break;
      }
    }
    
    // Only classify if not already forcing research mode
    const queryType = forceResearch ? 'research_needed' : await classifyQuery(queryContent);
    console.log(`Query classified as: ${queryType}${forceResearch ? ' (forced)' : ''}`);
    
    let responseStream: ReadableStream;
    
    if (queryType === 'simple') {
      console.log('Routing to simple query handler');
      responseStream = await handleSimpleQuery(queryContent, messages, fetchedContextText, streamThoughts, specificSnippetText);
    } else if (queryType === 'research_needed') {
      console.log('Routing to research query handler');
      responseStream = await handleResearchQuery(queryContent, messages, fetchedContextText, streamThoughts, specificSnippetText);
    } else { // 'complex' or default
      console.log('Routing to complex query handler');
      responseStream = await handleComplexQuery(queryContent, messages, fetchedContextText, streamThoughts, specificSnippetText);
    }
    
    // Launch citation verification in background if we have a conversation ID
    // This happens after initial response streaming has started
    if (conversationId && queryType !== 'simple') {
      // Launch citation verification in background
      (async () => {
        try {
          // Wait briefly to capture initial response
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Check database for the assistant message content
          const { data: assistantMsgData } = await supabaseAdmin
            .from('messages')
            .select('id, content')
            .eq('conversation_id', conversationId)
            .eq('role', 'assistant')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          if (assistantMsgData?.content) {
            // Extract citations from the response
            const citations = extractLegalCitations(assistantMsgData.content);
            
            if (citations.length > 0) {
              console.log(`Found ${citations.length} citations to verify in response`);
              
              // Verify each citation (up to first 3 to limit API calls)
              const citationsToVerify = citations.slice(0, 3);
              const verificationResults = await Promise.all(
                citationsToVerify.map(async (citation) => {
                  return verifyCitationWithPerplexity(citation);
                })
              );
              
              // Create a follow-up message with verification results
              const verificationSummary = formatVerificationResults(verificationResults);
              
              if (verificationSummary) {
                // Save the verification summary as a system message
                await supabaseAdmin
                  .from('messages')
                  .insert({
                    id: uuidv4(),
                    conversation_id: conversationId,
                    role: 'system',
                    content: verificationSummary,
                    owner_id: userId,
                    metadata: { type: 'citation_verification' }
                  });
                  
                console.log('Citation verification complete and stored in conversation');
              }
            } else {
              console.log('No citations found to verify in response');
            }
          }
        } catch (verifyError) {
          console.error('Error in citation verification:', verifyError);
        }
      })();
    }
    
    // Add the new conversation ID to the stream headers if it was just created
    const responseHeaders = { 
      ...corsHeaders, 
      'Content-Type': 'text/event-stream', 
      'Cache-Control': 'no-cache'
    };
    
    if (newConversationId) {
      responseHeaders['X-Conversation-Id'] = newConversationId;
    }
    
    return new Response(responseStream, {
      headers: responseHeaders
    });
    
  } catch (error) {
    console.error('Claude router error:', error);
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});