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

const { matchSalaries } = require('./lib/salary-matcher');
const { buildSalaryEstimatePrompt } = require('./prompts/salary-estimate');

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

async function callGeminiWithRetry(prompt, config, retries = 3) {
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
        const pos = parseInt(parseErr.message.match(/position (\d+)/)?.[1] || '0');
        if (pos > 0) {
          console.error('[context around pos ' + pos + ']', JSON.stringify(cleaned.substring(Math.max(0, pos - 80), pos + 80)));
        }
        throw parseErr;
      }
    } catch (err) {
      const isRateLimit = err.status === 429 || err.status === 503 || err.message?.includes('429') || err.message?.includes('quota');

      if (attempt === retries) {
        // Attach metadata so the HTTP handler can return appropriate status
        if (isRateLimit) {
          const rateLimitErr = new Error('Rate limit exceeded. Please wait a moment and try again.');
          rateLimitErr.statusCode = 429;
          throw rateLimitErr;
        }
        throw err;
      }

      // Exponential backoff: 1s → 3s → 9s (longer for rate limits)
      const baseDelay = isRateLimit ? 3000 : 1000;
      const delay = baseDelay * Math.pow(3, attempt - 1);
      console.error(`[attempt ${attempt}/${retries}] ${err.message} — retrying in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
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

function formatSalaryLabel(min, max, currency) {
  const fmt = (n) => {
    if (currency === 'INR') {
      if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
      return `₹${Math.round(n / 1000)}k`;
    }
    if (currency === 'USD') return `$${Math.round(n / 1000)}k`;
    if (currency === 'GBP') return `£${Math.round(n / 1000)}k`;
    return `${currency}${Math.round(n / 1000)}k`;
  };
  if (min === max) return fmt(min);
  return `${fmt(min)} - ${fmt(max)}`;
}

async function handleSalaryLookup(body) {
  const { jobs, forceAi } = body;
  if (!jobs || !Array.isArray(jobs)) throw new Error('Missing jobs array');

  // If forceAi, skip DB and go straight to Gemini
  // Let rate limit errors propagate to HTTP handler (returns 429 to client)
  if (forceAi) {
    const results = await Promise.all(
      jobs.map(async (job) => {
        try {
          const prompt = buildSalaryEstimatePrompt(job.title, job.company, job.location);
          const geminiResult = await callGeminiWithRetry(prompt, {
            responseMimeType: 'application/json',
            temperature: 0.3,
            maxOutputTokens: 256,
          });
          return {
            found: true,
            salaryMin: geminiResult.salaryMin,
            salaryMax: geminiResult.salaryMax,
            salaryMedian: geminiResult.salaryMedian,
            currency: geminiResult.currency,
            matchType: 'ai_estimate',
            source: 'gemini',
            isAiEstimate: true,
            confidence: geminiResult.confidence,
            label: formatSalaryLabel(geminiResult.salaryMin, geminiResult.salaryMax, geminiResult.currency),
          };
        } catch (err) {
          console.error(`[salary] AI estimate failed for "${job.title}":`, err.message);
          // Propagate rate limit errors so HTTP handler returns 429
          if (err.statusCode === 429) throw err;
          return { found: false, matchType: 'none', isAiEstimate: false, label: 'Estimate Failed' };
        }
      })
    );
    return { results };
  }

  // First pass: match from DB
  const dbResults = matchSalaries(jobs);

  // Second pass: Gemini fallback for unmatched
  const results = await Promise.all(
    dbResults.map(async (result, i) => {
      if (result.found) return result;

      // Try Gemini estimate
      try {
        const job = jobs[i];
        const prompt = buildSalaryEstimatePrompt(job.title, job.company, job.location);
        const geminiResult = await callGeminiWithRetry(prompt, {
          responseMimeType: 'application/json',
          temperature: 0.3,
          maxOutputTokens: 256,
        });

        return {
          found: true,
          salaryMin: geminiResult.salaryMin,
          salaryMax: geminiResult.salaryMax,
          salaryMedian: geminiResult.salaryMedian,
          currency: geminiResult.currency,
          matchType: 'ai_estimate',
          source: 'gemini',
          isAiEstimate: true,
          confidence: geminiResult.confidence,
          label: formatSalaryLabel(geminiResult.salaryMin, geminiResult.salaryMax, geminiResult.currency),
        };
      } catch (err) {
        console.error(`[salary] Gemini fallback failed for "${jobs[i].title}":`, err.message);
        return result; // Return the "not found" result
      }
    })
  );

  return { results };
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
    } else if (req.url === '/api/salary-lookup') {
      console.log('[salary] Looking up', body.jobs?.length, 'jobs...');
      result = await handleSalaryLookup(body);
      const matched = result.results.filter(r => r.found).length;
      const aiCount = result.results.filter(r => r.isAiEstimate).length;
      console.log(`[salary] Done: ${matched} found (${aiCount} AI estimates)`);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    const statusCode = err.statusCode || 500;
    console.error(`[error ${statusCode}]`, err.message);
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message, code: statusCode }));
  }
});

server.listen(PORT, () => {
  console.log(`\n  LinkedIntel API dev server running at http://localhost:${PORT}`);
  console.log('  Endpoints:');
  console.log('    POST /api/gemini-match');
  console.log('    POST /api/gemini-connect');
  console.log('    POST /api/salary-lookup\n');
});
