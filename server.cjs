const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const LOG_FILE = path.join(__dirname, 'server.log');
const cors = require('cors');

function logToFile(...args) {
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ') + '\n';
  fs.appendFileSync(LOG_FILE, msg);
}
const origLog = console.log;
const origError = console.error;
console.log = (...args) => { origLog(...args); logToFile(...args); };
console.error = (...args) => { origError(...args); logToFile(...args); };

console.log('CourtListener token:', process.env.COURTLISTENER_API_TOKEN ? process.env.COURTLISTENER_API_TOKEN.slice(0, 6) + '...' : 'NOT SET');
console.log('OpenAI key:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.slice(0, 6) + '...' : 'NOT SET');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Service Role Key not set in environment variables!');
}

const supabase = createClient(supabaseUrl, supabaseKey);
console.log('Supabase client initialized (using Service Role Key).');

const app = express();
app.use(cors());
app.use(express.json());

// POST /api/research: Accepts { question, clarifications? } and returns CourtListener results and OpenAI answer
app.post('/api/research', async (req, res) => {
  try {
    console.log('--- Incoming /api/research request ---');
    console.log('Request body:', req.body);
    const { question, clarifications } = req.body;
    if (!question) return res.status(400).json({ error: 'Missing question' });

    // Stage 1: Use OpenAI to extract filters and construct query
    const clarifyPrompt = `You are a legal research assistant. Given the user's question and any clarifications, extract the most relevant:
- Jurisdiction (e.g., Supreme Court, Federal, State, or specific state)
- Date range (e.g., last 5 years, since 2000, etc.)
- Case type (e.g., criminal, civil, appellate, etc.)
- Any other relevant filters
- A CourtListener search query string
If any of these are unclear or missing, suggest up to 2 very simple clarification questions for the user. If everything is clear, return the constructed search parameters and query. Respond in JSON like this:
{"jurisdiction":..., "date_range":..., "case_type":..., "query":..., "clarification_questions":[]}
User question: "${question}"
${clarifications && clarifications.length ? `Clarifications: ${clarifications.join(' | ')}` : ''}`;

    const clarifyReq = {
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a legal research assistant.' },
        { role: 'user', content: clarifyPrompt }
      ],
      temperature: 0.1,
      max_tokens: 500
    };
    console.log('OpenAI clarify prompt:', clarifyPrompt);
    const clarifyRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(clarifyReq)
    });
    if (!clarifyRes.ok) {
      const errText = await clarifyRes.text();
      console.error('OpenAI clarify API error:', errText);
      return res.status(clarifyRes.status).json({ error: 'OpenAI clarify API error', status: clarifyRes.status, details: errText });
    }
    const clarifyData = await clarifyRes.json();
    let clarifyJson;
    try {
      clarifyJson = JSON.parse(clarifyData.choices?.[0]?.message?.content || '{}');
    } catch (e) {
      console.error('Failed to parse OpenAI clarify response:', clarifyData);
      return res.status(500).json({ error: 'Failed to parse OpenAI clarify response', details: clarifyData });
    }
    console.log('OpenAI clarify response:', clarifyJson);
    if (clarifyJson.clarification_questions && clarifyJson.clarification_questions.length) {
      return res.json({ status: 'clarification_needed', clarifyingQuestions: clarifyJson.clarification_questions });
    }
    // Build CourtListener query from AI output
    let clQuery = clarifyJson.query || question;
    let clUrl = `https://www.courtlistener.com/api/rest/v3/search/?q=${encodeURIComponent(clQuery)}&type=o&order_by=dateFiled desc&page_size=5`;
    // Add filters if present
    if (clarifyJson.jurisdiction) {
      // Example: add court filter (real implementation may need mapping)
      // clUrl += `&court=${encodeURIComponent(clarifyJson.jurisdiction)}`;
    }
    if (clarifyJson.date_range) {
      // Example: parse date_range and add date_filed_min/max
      // clUrl += `&date_filed_min=...&date_filed_max=...`;
    }
    console.log('CourtListener API URL:', clUrl);
    const apiHeaders = {
      'Authorization': `Token ${process.env.COURTLISTENER_API_TOKEN}`,
      'Accept': 'application/json'
    };
    const response = await fetch(clUrl, { headers: apiHeaders });
    console.log('CourtListener API response status:', response.status);
    if (!response.ok) {
      const errText = await response.text();
      console.error('CourtListener API error response:', errText);
      return res.status(response.status).json({ error: 'CourtListener API error', status: response.status, details: errText });
    }
    const data = await response.json();
    const snippets = (data.results || []).slice(0, 5);
    // Stage 2: Summarization
    const ragPrompt = `Legal research context:\n${snippets.map(s => s.snippet || s.plain_text || s.summary || '').join('\n---\n')}\n\nUser question: ${question}`;
    const openaiReq = {
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a legal research assistant. Use only the provided legal context to answer the user question as accurately as possible. If the context is insufficient, say so.' },
        { role: 'user', content: ragPrompt }
      ],
      temperature: 0.1,
      max_tokens: 800
    };
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(openaiReq)
    });
    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error('OpenAI API error response:', errText);
      return res.status(openaiRes.status).json({ error: 'OpenAI API error', status: openaiRes.status, details: errText });
    }
    const openaiData = await openaiRes.json();
    const answer = openaiData.choices?.[0]?.message?.content || '';
    res.json({ status: 'searching', filtersUsed: clarifyJson, snippets, answer });
  } catch (err) {
    console.error('Error in /api/research:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function for OpenAI API calls
async function callOpenAI(messages, maxTokens = 500, temperature = 0.5) {
  const openaiReq = {
    model: 'gpt-4', // Or consider a faster/cheaper model like gpt-3.5-turbo if appropriate
    messages,
    temperature,
    max_tokens: maxTokens
  };
  console.log('Calling OpenAI with messages:', JSON.stringify(messages, null, 2));
  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify(openaiReq)
  });

  if (!openaiRes.ok) {
    const errText = await openaiRes.text();
    console.error('OpenAI API error:', errText);
    // Throw an error object to be caught by the route handler
    const error = new Error('OpenAI API error');
    error.status = openaiRes.status;
    error.details = errText;
    throw error;
  }

  const openaiData = await openaiRes.json();
  console.log('OpenAI response data:', JSON.stringify(openaiData, null, 2));
  const resultText = openaiData.choices?.[0]?.message?.content?.trim() || null;
  if (!resultText) {
    console.error('OpenAI returned empty or unexpected response structure', openaiData);
    throw new Error('OpenAI returned empty result');
  }
  return resultText;
}

// POST /api/chat - Handles general streaming chat completions
app.post('/api/chat', async (req, res) => {
  console.log('--- Incoming /api/chat request ---');
  const { 
    conversationId, 
    message, 
    history = [], // Default to empty array if not provided
    caseId, 
    documentContext, 
    analysisContext 
  } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Missing message in request body' });
  }
  if (!conversationId) {
    // Although sendMessageStream should create one, double-check here
    return res.status(400).json({ error: 'Missing conversationId' }); 
  }
   if (!caseId) {
    // Essential context, ensure it's present
    return res.status(400).json({ error: 'Missing caseId' });
  }

  console.log(`Chat for conv: ${conversationId}, case: ${caseId}, msg: "${message.substring(0, 50)}..."`);

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.error('OPENAI_API_KEY is not set in environment variables!');
    return res.status(500).json({ error: 'Server configuration error: Missing OpenAI API Key' });
  }

  try {
    // --- Construct messages for OpenAI --- 
    let messagesToSend = [
      // Base system prompt (adjust as needed)
      { role: 'system', content: 'You are a helpful AI paralegal assistant.' }, 
      // TODO: Consider adding case-specific context here if available?
      // TODO: Incorporate documentContext and analysisContext intelligently into the prompt or system message
    ];

    // Add history (ensure it's in the correct format)
    const formattedHistory = history
      .filter(msg => msg && typeof msg.role === 'string' && typeof msg.content === 'string') // Basic validation
      .map(msg => ({ role: msg.role, content: msg.content }));
    messagesToSend = messagesToSend.concat(formattedHistory);

    // Add the current user message
    messagesToSend.push({ role: 'user', content: message });

    // --- Prepare OpenAI API Request --- 
    const openaiReqBody = {
      model: 'gpt-4', // Or desired model like 'gpt-4-turbo'
      messages: messagesToSend,
      stream: true, // Enable streaming
      temperature: 0.7, // Adjust as needed
      max_tokens: 1500, // Adjust as needed
    };

    console.log('Calling OpenAI stream API...');
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
        'Accept': 'text/event-stream' // Necessary for SSE streaming
      },
      body: JSON.stringify(openaiReqBody)
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error('OpenAI Stream API error response:', errText);
      return res.status(openaiRes.status).json({ error: 'OpenAI API error', status: openaiRes.status, details: errText });
    }

    // --- Pipe the stream back to the client --- 
    console.log('Streaming response back to client...');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Ensure body is piped correctly. Node-fetch might require .body.pipe(res)
    // If using native fetch (Node 18+), response.body should be a ReadableStream
    if (openaiRes.body && typeof openaiRes.body.pipe === 'function') {
        openaiRes.body.pipe(res);
    } else if (openaiRes.body) {
        // Handle potential differences if native fetch or other library is used
        // This assumes openaiRes.body is a ReadableStream
        const reader = openaiRes.body.getReader();
        const decoder = new TextDecoder();
        const pump = async () => {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            return;
          }
          res.write(decoder.decode(value, { stream: true }));
          pump();
        };
        pump().catch(err => {
            console.error('Error pumping stream:', err);
            if (!res.headersSent) {
              res.status(500).send('Stream Error');
            }
            res.end();
        });
    } else {
        console.error('OpenAI response body is null or not pipeable/readable.');
        res.status(500).end('Failed to get stream from OpenAI');
    }

  } catch (err) {
    console.error('Error in /api/chat route handler:', err);
     if (!res.headersSent) { // Avoid setting headers if stream already started
         res.status(500).json({ error: 'Internal server error while processing chat request' });
     } else {
         // If stream started, we can't send JSON, just end the connection
         res.end();
     }
  }
});

// POST /api/perplexity
app.post('/api/perplexity', async (req, res) => {
  console.log('--- Incoming /api/perplexity request ---');
  const { query } = req.body; // Removed conversationId as it's not directly used in the API call structure shown

  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }
  console.log(`Query: ${query}`);

  // Ensure the API token is available
  const perplexityApiKey = process.env.PERPLEXITY_API_TOKEN;
  if (!perplexityApiKey) {
    console.error('PERPLEXITY_API_TOKEN is not set in environment variables!');
    return res.status(500).json({ error: 'Server configuration error: Missing Perplexity API Token' });
  }

  try {
    console.log('Calling Perplexity API directly...');
    
    // Construct the request body for Perplexity API
    const perplexityReqBody = {
      model: 'sonar-pro', // Using the model specified in the example
      messages: [
        {
          role: 'system',
          content: 'Be precise and concise.' // System message from example
        },
        {
          role: 'user',
          content: query // User's query
        }
      ],
      // Add other parameters like temperature, max_tokens if needed later
      // temperature: 0.2, 
      // max_tokens: 500 
    };

    const perplexityRes = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'Authorization': `Bearer ${perplexityApiKey}`
      },
      body: JSON.stringify(perplexityReqBody)
    });

    if (!perplexityRes.ok) {
      const errText = await perplexityRes.text();
      console.error('Perplexity API error:', errText);
      // Forward the status code from Perplexity if possible
      return res.status(perplexityRes.status).json({ error: 'Perplexity API error', status: perplexityRes.status, details: errText });
    }

    const perplexityData = await perplexityRes.json();
    console.log('Perplexity API response received.');
    // Log the structure to understand how to extract the answer (optional but helpful for debugging)
    // console.log('Perplexity Response Data:', JSON.stringify(perplexityData, null, 2)); 

    // Extract the answer - adjust based on the actual response structure
    // Assuming structure is similar to OpenAI:
    const answer = perplexityData.choices?.[0]?.message?.content || ''; 
    const sources = perplexityData.sources || []; // Assuming sources might be part of the response

    // Send the answer and potentially sources back to the client
    res.status(200).json({ answer: answer, sources: sources }); 

  } catch (err) {
    console.error('Error in /api/perplexity route handler (direct call):', err);
    // Check if it's a fetch error (e.g., network issue)
    if (err instanceof Error && 'cause' in err) {
       console.error('Fetch error cause:', err.cause);
    }
    res.status(500).json({ error: 'Internal server error while processing Perplexity request' });
  }
});

// --- Helper to Fetch Document Content ---
async function getDocumentContentFromSupabase(docId) {
  console.log(`Fetching document metadata for ID: ${docId}`);
  // 1. Get storage_path AND content_type from the documents table
  const { data: docData, error: docError } = await supabase
    .from('documents')
    .select('storage_path, filename, content_type') // Also fetch content_type
    .eq('id', docId)
    .single();

  if (docError) {
    console.error(`Error fetching document metadata for ${docId}:`, docError);
    throw new Error(`Document metadata not found or inaccessible for ID ${docId}.`);
  }

  if (!docData || !docData.storage_path) {
    console.error(`Storage path not found for document ID: ${docId}`);
    throw new Error(`Storage path missing for document ID ${docId}.`);
  }

  const storagePath = docData.storage_path;
  const filename = docData.filename;
  const contentType = docData.content_type || ''; // Get content type
  console.log(`Found storage path: ${storagePath} for document: ${filename} (Type: ${contentType})`);

  // 2. Download the document content from storage
  console.log(`Downloading document content from path: ${storagePath}`);
  const { data: blobData, error: downloadError } = await supabase.storage
    .from('documents')
    .download(storagePath);

  if (downloadError) {
    console.error(`Error downloading document ${storagePath}:`, downloadError);
    throw new Error(`Failed to download document content from ${storagePath}.`);
  }

  if (!blobData) {
    console.error(`No content downloaded for document: ${storagePath}`);
    throw new Error(`Downloaded content is empty for ${storagePath}.`);
  }

  console.log(`Successfully downloaded ${filename} (${blobData.size} bytes)`);

  // 3. Extract text based on content type
  try {
    // Convert blob to Buffer for libraries
    const buffer = Buffer.from(await blobData.arrayBuffer());

    if (contentType === 'application/pdf') {
      console.log(`Parsing PDF: ${filename}`);
      const pdfData = await pdfParse(buffer);
      return pdfData.text;
    } else if (contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || filename.endsWith('.docx')) {
      console.log(`Parsing DOCX: ${filename}`);
      const docxData = await mammoth.extractRawText({ buffer });
      return docxData.value;
    } else if (contentType.startsWith('text/')) {
        console.log(`Parsing Text: ${filename}`);
        // Fallback for plain text types
        return buffer.toString('utf-8');
    } else {
        console.warn(`Unsupported content type for text extraction: ${contentType} (${filename})`);
        throw new Error(`Unsupported document type for text extraction: ${contentType}`);
    }
  } catch (parseError) {
      console.error(`Error parsing content for ${filename} (Type: ${contentType}):`, parseError);
      throw new Error(`Could not parse content of document ${filename}. ${parseError.message}`);
  }
}

// --- Agent Endpoints ---

// Helper function for streaming OpenAI calls for agents
async function streamAgentResponse(req, res, systemPrompt, userPromptContent) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.error('OPENAI_API_KEY is not set in environment variables!');
    return res.status(500).json({ error: 'Server configuration error: Missing OpenAI API Key' });
  }

  try {
    const messagesToSend = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPromptContent }
    ];

    const openaiReqBody = {
      model: 'gpt-4', // Consider appropriate model for agent tasks
      messages: messagesToSend,
      stream: true,
      temperature: 0.5, // Adjust temperature based on task creativity needed
      max_tokens: 2000, // Allow longer responses for agent tasks
    };

    console.log(`Calling OpenAI stream API for agent: ${req.path}`);
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(openaiReqBody)
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error(`OpenAI Stream API error (${req.path}):`, errText);
      return res.status(openaiRes.status).json({ error: 'OpenAI API error', status: openaiRes.status, details: errText });
    }

    console.log(`Streaming response back to client for ${req.path}...`);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (openaiRes.body && typeof openaiRes.body.pipe === 'function') {
      openaiRes.body.pipe(res);
    } else if (openaiRes.body) {
      const reader = openaiRes.body.getReader();
      const decoder = new TextDecoder();
      const pump = async () => {
        const { done, value } = await reader.read();
        if (done) {
          res.end(); return;
        }
        res.write(decoder.decode(value, { stream: true }));
        pump();
      };
      pump().catch(err => {
        console.error(`Error pumping stream (${req.path}):`, err);
        if (!res.headersSent) res.status(500).send('Stream Error');
        res.end();
      });
    } else {
      console.error(`OpenAI response body is null or not pipeable/readable (${req.path}).`);
      res.status(500).end('Failed to get stream from OpenAI');
    }
  } catch (err) {
    console.error(`Error in streamAgentResponse helper (${req.path}):`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: `Internal server error (${req.path})` });
    } else {
      res.end();
    }
  }
}

// POST /api/agent/draft
app.post('/api/agent/draft', async (req, res) => {
  console.log('--- Incoming /api/agent/draft request ---');
  const { instructions, caseId, documentContext, analysisContext } = req.body;
  if (!instructions) return res.status(400).json({ error: 'Missing instructions' });
  if (!caseId) return res.status(400).json({ error: 'Missing caseId' });

  // TODO: Fetch document/analysis context if needed based on IDs/strings
  const contextText = documentContext ? `\\n\\nDocument Context:\\n${documentContext}` : ''; // Simple context inclusion for now
  const analysisText = analysisContext ? `\\n\\nAnalysis Context:\\n${analysisContext}` : '';
  
  const systemPrompt = 'You are a legal drafting assistant. Generate the requested legal document or text based on the instructions and provided context. Maintain a professional legal tone.';
  const userPromptContent = `Drafting Instructions: ${instructions}${contextText}${analysisText}`;

  await streamAgentResponse(req, res, systemPrompt, userPromptContent);
});

// POST /api/agent/find-clause
app.post('/api/agent/find-clause', async (req, res) => {
  console.log('--- Incoming /api/agent/find-clause request ---');
  const { clause, docId, caseId } = req.body;
  if (!clause) return res.status(400).json({ error: 'Missing clause description' });
  if (!docId) return res.status(400).json({ error: 'Missing document ID (docId)' });
  if (!caseId) return res.status(400).json({ error: 'Missing caseId' });

  try {
    const documentContent = await getDocumentContentFromSupabase(docId);

    const systemPrompt = 'You are a legal text analysis assistant. Find and extract the specific clause described by the user within the provided document text. If the clause is not found, state that clearly.';
    const userPromptContent = `Find the clause described as: "${clause}"\\n\\nIn the following document:\\n---\\n${documentContent}\\n---`;

    await streamAgentResponse(req, res, systemPrompt, userPromptContent);
  } catch (err) {
    console.error('Error processing find-clause agent:', err);
    res.status(500).json({ error: err.message || 'Failed to process find-clause request' });
  }
});

// POST /api/agent/generate-timeline
app.post('/api/agent/generate-timeline', async (req, res) => {
  console.log('--- Incoming /api/agent/generate-timeline request ---');
  const { docId, caseId } = req.body;
  if (!docId) return res.status(400).json({ error: 'Missing document ID (docId)' });
  if (!caseId) return res.status(400).json({ error: 'Missing caseId' });

  try {
    const documentContent = await getDocumentContentFromSupabase(docId);

    const systemPrompt = 'You are a legal text analysis assistant. Extract key dates, events, and corresponding details from the provided document text and present them as a chronological timeline. Format clearly (e.g., using markdown lists or tables).';
    const userPromptContent = `Generate a timeline from the following document:\\n---\\n${documentContent}\\n---`;

    await streamAgentResponse(req, res, systemPrompt, userPromptContent);
   } catch (err) {
    console.error('Error processing generate-timeline agent:', err);
    res.status(500).json({ error: err.message || 'Failed to process generate-timeline request' });
  }
});

// POST /api/agent/explain-term
app.post('/api/agent/explain-term', async (req, res) => {
  console.log('--- Incoming /api/agent/explain-term request ---');
  const { term, jurisdiction, caseId } = req.body;
  if (!term) return res.status(400).json({ error: 'Missing term to explain' });
   // caseId might not be strictly necessary but good for context/logging
  
  const jurisdictionContext = jurisdiction ? ` within the context of ${jurisdiction} law` : '';
  
  const systemPrompt = `You are a legal dictionary assistant. Explain the provided legal term or acronym clearly and concisely. If a jurisdiction is provided, tailor the explanation accordingly.`;
  const userPromptContent = `Explain the term: "${term}"${jurisdictionContext}.`;

  await streamAgentResponse(req, res, systemPrompt, userPromptContent);
});

// POST /api/agent/compare
app.post('/api/agent/compare', async (req, res) => {
  console.log('--- Incoming /api/agent/compare request ---');
  const { documentContexts, caseId, analysisContext } = req.body;
  if (!Array.isArray(documentContexts) || documentContexts.length < 2) {
      return res.status(400).json({ error: 'Requires an array of at least two document contexts (IDs or content)' });
  }
  if (!caseId) return res.status(400).json({ error: 'Missing caseId' });

  try {
    // Fetch content for all documents concurrently
    const docPromises = documentContexts.map(docId => getDocumentContentFromSupabase(docId));
    const docContents = await Promise.all(docPromises);

    // Construct the prompt with multiple documents
    let userPromptContent = 'Compare the following documents:\n\n';
    docContents.forEach((content, index) => {
        userPromptContent += `Document ${index + 1}:\n---\n${content}\n---\n\n`;
    });

    const systemPrompt = 'You are a legal document comparison assistant. Compare the provided documents, highlighting key differences and similarities relevant to legal analysis. Be specific and structured in your comparison.';

    await streamAgentResponse(req, res, systemPrompt, userPromptContent);
   } catch (err) {
    console.error('Error processing compare agent:', err);
    res.status(500).json({ error: err.message || 'Failed to process compare request' });
  }
});

// POST /api/agent/flag-privileged-terms
app.post('/api/agent/flag-privileged-terms', async (req, res) => {
  console.log('--- Incoming /api/agent/flag-privileged-terms request ---');
  const { docId, caseId } = req.body;
  if (!docId) return res.status(400).json({ error: 'Missing document ID (docId)' });
  if (!caseId) return res.status(400).json({ error: 'Missing caseId' });

  try {
    const documentContent = await getDocumentContentFromSupabase(docId);

    const systemPrompt = 'You are a legal text analysis assistant specializing in identifying potentially privileged information. Scan the provided document text for terms, phrases, or discussions that might indicate attorney-client privilege, work product doctrine, or other forms of legal privilege. List the findings clearly. Be cautious and flag potential issues rather than making definitive legal conclusions.';
    const userPromptContent = `Scan the following document for potentially privileged terms or content:\\n---\\n${documentContent}\\n---`;

    await streamAgentResponse(req, res, systemPrompt, userPromptContent);
   } catch (err) {
    console.error('Error processing flag-privileged-terms agent:', err);
    res.status(500).json({ error: err.message || 'Failed to process flag-privileged-terms request' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
}); 