const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const LOG_FILE = path.join(__dirname, 'server.log');

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

const app = express();
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

// POST /api/ai/rewrite
app.post('/api/ai/rewrite', async (req, res) => {
  console.log('--- Incoming /api/ai/rewrite request ---');
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing text to rewrite' });

  try {
    const messages = [
      { role: 'system', content: 'You are an expert legal writing assistant. Rewrite the following text clearly and concisely, maintaining the original meaning. Focus on improving clarity and flow for a legal professional audience.' },
      { role: 'user', content: `Rewrite the following text:\n\n${text}` }
    ];
    const rewrittenText = await callOpenAI(messages, 1024, 0.6); // Allow more tokens for rewriting
    res.json({ result: rewrittenText });
  } catch (err) {
    console.error('Error in /api/ai/rewrite:', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error', details: err.details });
  }
});

// POST /api/ai/summarize
app.post('/api/ai/summarize', async (req, res) => {
  console.log('--- Incoming /api/ai/summarize request ---');
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing text to summarize' });

  try {
    const messages = [
      { role: 'system', content: 'You are an expert legal writing assistant. Summarize the key points of the following text concisely for a legal professional.' },
      { role: 'user', content: `Summarize the following text:\n\n${text}` }
    ];
    const summarizedText = await callOpenAI(messages, 512, 0.3); // Fewer tokens, lower temp for summary
    res.json({ result: summarizedText });
  } catch (err) {
    console.error('Error in /api/ai/summarize:', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error', details: err.details });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
}); 