import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Inline salary matching for Vercel (can't require .js modules easily)
// The dev server uses the full salary-matcher.js; this is a lightweight shim
// that delegates to the same /api/salary-lookup dev-server route in development.
// In production on Vercel, this endpoint handles matching + Gemini fallback.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { jobs } = req.body;
    if (!jobs || !Array.isArray(jobs)) {
      return res.status(400).json({ error: 'Missing jobs array' });
    }

    // In production, we'd load the salary DB and do matching here.
    // For now, delegate all to Gemini estimation for unmatched jobs.
    const results = await Promise.all(
      jobs.map(async (job: { title: string; company: string; location: string }) => {
        try {
          return await estimateWithGemini(job.title, job.company, job.location);
        } catch {
          return {
            found: false,
            isAiEstimate: false,
            matchType: 'none',
            label: 'Data Unavailable',
          };
        }
      })
    );

    return res.status(200).json({ results });
  } catch (err) {
    console.error('Salary lookup error:', err);
    return res.status(500).json({ error: 'Salary lookup failed' });
  }
}

async function estimateWithGemini(title: string, company: string, location: string) {
  const prompt = `You are a salary data analyst. Estimate the annual compensation for the following role.

Role: ${title}
Company: ${company || 'Unknown'}
Location: ${location || 'Unknown'}

Instructions:
- Use the LOCAL CURRENCY for the location (e.g., INR for India, USD for US, GBP for UK)
- Be conservative — use median market rates, not top-of-band
- If the company is well-known, adjust based on their typical pay bands

Return ONLY a JSON object with these exact fields:
{
  "salaryMin": <number>,
  "salaryMax": <number>,
  "salaryMedian": <number>,
  "currency": "<3-letter currency code>",
  "confidence": "<high|medium|low>"
}`;

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
      maxOutputTokens: 256,
    },
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const parsed = JSON.parse(text);

  // Format label based on currency
  const label = formatLabel(parsed.salaryMin, parsed.salaryMax, parsed.currency);

  return {
    found: true,
    salaryMin: parsed.salaryMin,
    salaryMax: parsed.salaryMax,
    salaryMedian: parsed.salaryMedian,
    currency: parsed.currency,
    matchType: 'ai_estimate',
    source: 'gemini',
    isAiEstimate: true,
    confidence: parsed.confidence,
    label,
  };
}

function formatLabel(min: number, max: number, currency: string): string {
  const fmt = (n: number) => {
    if (currency === 'INR') {
      if (n >= 100000) return `\u20b9${(n / 100000).toFixed(1)}L`;
      return `\u20b9${Math.round(n / 1000)}k`;
    }
    if (currency === 'USD') return `$${Math.round(n / 1000)}k`;
    if (currency === 'GBP') return `\u00a3${Math.round(n / 1000)}k`;
    return `${currency}${Math.round(n / 1000)}k`;
  };
  if (min === max) return fmt(min);
  return `${fmt(min)} - ${fmt(max)}`;
}
