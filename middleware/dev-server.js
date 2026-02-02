/**
 * Local dev server for testing the Gemini middleware.
 *
 * Usage:
 *   1. Set your Gemini API key:  set GEMINI_API_KEY=your_key_here
 *   2. Run:                      node middleware/dev-server.js
 *
 * The extension's service worker will call http://localhost:3001/api/gemini-match
 * and http://localhost:3001/api/gemini-connect
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3099;
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error('\n  ERROR: GEMINI_API_KEY environment variable is not set.\n');
  console.error('  Get a free key from: https://aistudio.google.com/apikey');
  console.error('  Then run:\n');
  console.error('    set GEMINI_API_KEY=your_key_here');
  console.error('    node middleware/dev-server.js\n');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

function stripPII(text) {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[EMAIL]')
    .replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE]')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
}

function cleanJsonResponse(text) {
  // Strip markdown code fences that Gemini sometimes wraps around JSON
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  // Fix literal newlines inside JSON string values.
  // Walk through char-by-char: when inside a quoted string,
  // replace raw newlines with escaped \n.
  let fixed = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escaped) {
      fixed += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      fixed += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      fixed += ch;
      continue;
    }
    if (inString && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && cleaned[i + 1] === '\n') i++; // skip \r\n pair
      fixed += '\\n';
      continue;
    }
    fixed += ch;
  }
  cleaned = fixed;

  // Fix common Gemini JSON issues:
  // 1. Trailing commas before ] or }
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  return cleaned;
}

async function callGeminiWithRetry(prompt, config, retries = 2) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: config,
  });

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const raw = result.response.text();
      // Dump full raw response for debugging
      const debugFile = path.join(__dirname, 'last-raw-response.txt');
      fs.writeFileSync(debugFile, raw, 'utf8');
      console.log('[debug] Raw response saved to', debugFile, '(' + raw.length + ' chars)');
      const cleaned = cleanJsonResponse(raw);
      const debugCleanedFile = path.join(__dirname, 'last-cleaned-response.txt');
      fs.writeFileSync(debugCleanedFile, cleaned, 'utf8');
      try {
        return JSON.parse(cleaned);
      } catch (parseErr) {
        console.error(`[attempt ${attempt}/${retries}] JSON parse failed:`, parseErr.message);
        // Show context around the failure position
        const pos = parseInt(parseErr.message.match(/position (\d+)/)?.[1] || '0');
        if (pos > 0) {
          console.error('[context around pos ' + pos + ']', JSON.stringify(cleaned.substring(Math.max(0, pos - 80), pos + 80)));
        }
        throw parseErr;
      }
    } catch (err) {
      if (attempt === retries) throw err;
      console.error(`[attempt ${attempt}/${retries}]`, err.message);
      // Brief pause before retry
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function handleMatch(body) {
  const sanitizedPrompt = stripPII(body.prompt);
  return callGeminiWithRetry(sanitizedPrompt, {
    responseMimeType: 'application/json',
    temperature: 0.3,
    maxOutputTokens: 65536,
  });
}

async function handleConnect(body) {
  return callGeminiWithRetry(body.prompt, {
    responseMimeType: 'application/json',
    temperature: 0.7,
    maxOutputTokens: 2048,
  });
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // Read body
  let rawBody = '';
  for await (const chunk of req) rawBody += chunk;

  try {
    const body = JSON.parse(rawBody);
    let result;

    if (req.url === '/api/gemini-match') {
      console.log('[match] Processing resume vs JD...');
      result = await handleMatch(body);
      console.log('[match] Done:', result.matchPercent + '%', result.status);
    } else if (req.url === '/api/gemini-connect') {
      console.log('[connect] Generating icebreaker...');
      result = await handleConnect(body);
      console.log('[connect] Done:', result.message?.substring(0, 50) + '...');
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error('[error]', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`\n  LinkedIntel API dev server running at http://localhost:${PORT}`);
  console.log('  Endpoints:');
  console.log('    POST /api/gemini-match');
  console.log('    POST /api/gemini-connect\n');
});
