/**
 * Build a Gemini prompt for salary estimation when no DB match is found.
 */

function buildSalaryEstimatePrompt(title, company, location) {
  return `You are a salary data analyst. Estimate the annual compensation for the following role.

Role: ${title}
Company: ${company || 'Unknown'}
Location: ${location || 'Unknown'}

Instructions:
- Use the LOCAL CURRENCY for the location (e.g., INR for India, USD for US, GBP for UK)
- Be conservative — use median market rates, not top-of-band
- If the company is well-known, adjust based on their typical pay bands
- For Indian locations, express salary in annual INR
- For US locations, express salary in annual USD

Return ONLY a JSON object with these exact fields:
{
  "salaryMin": <number — annual minimum in local currency>,
  "salaryMax": <number — annual maximum in local currency>,
  "salaryMedian": <number — annual median in local currency>,
  "currency": "<3-letter currency code e.g. INR, USD, GBP>",
  "confidence": "<high|medium|low>"
}`;
}

module.exports = { buildSalaryEstimatePrompt };
