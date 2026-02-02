import type { IntentType, ProfileData } from './types';

export function buildMatchPrompt(resumeText: string, jdText: string): string {
  return `You are an expert recruiter analyzing a candidate's resume against a job description.

## Resume
${resumeText}

## Job Description
${jdText}

## Instructions
Compare the resume against the job description. Focus on:
1. Years of experience match
2. Hard skills match (programming languages, tools, frameworks)
3. Soft skills and domain knowledge

Return a JSON object with exactly this structure:
{
  "matchPercent": <number 0-100>,
  "status": "<strong|moderate|weak>",
  "summary": "<1-2 sentence summary of the match quality>",
  "matchedSkills": ["<skill1>", "<skill2>", ...],
  "missingSkills": ["<skill1>", "<skill2>", ...],
  "categories": [
    {
      "name": "<category name>",
      "score": <number 0-100>,
      "status": "<strong|moderate|weak>",
      "matched": ["<what aligns, max 3>"],
      "missing": ["<what's lacking, max 3>"]
    }
  ],
  "recommendations": [
    {
      "area": "<category this applies to>",
      "suggestion": "<what to add or change>",
      "example": "<a ready-to-use resume bullet point>",
      "priority": "<high|medium|low>"
    }
  ]
}

Rules:
- matchPercent >= 75 → status "strong"
- matchPercent 50-74 → status "moderate"
- matchPercent < 50 → status "weak"
- Maximum 5 items each for matchedSkills and missingSkills
- Keep summary concise and actionable
- categories must include exactly these 5, in this order:
  1. "Experience" — years and relevance of work experience
  2. "Technical Skills" — languages, tools, frameworks
  3. "Domain Knowledge" — industry-specific expertise
  4. "Education & Certifications" — degrees, certs, courses
  5. "Soft Skills" — leadership, communication, teamwork
- Each category score follows the same strong/moderate/weak thresholds
- Each category matched and missing arrays have at most 3 items
- recommendations: 3-5 items sorted by priority (high first)
- Each recommendation example should be a concrete resume bullet point the candidate can use
- Do NOT use ellipsis (...) or trailing commas in arrays
- Do NOT use single quotes — only double quotes for JSON strings
- Escape any double quotes inside string values with backslash
- Return ONLY valid JSON, no markdown, no comments`;
}

export function buildConnectPrompt(
  profile: ProfileData,
  intent: IntentType,
  resumeContext?: string
): string {
  const intentLabels: Record<IntentType, string> = {
    referral: 'asking for a job referral',
    connect: 'general professional networking',
    business: 'exploring a business opportunity',
  };

  return `You are a professional networking assistant. Generate a personalized LinkedIn connection message.

## Target Profile
- Name: ${profile.name}
- Headline: ${profile.headline}
- About: ${profile.about}
- Company: ${profile.currentCompany}
- Recent Activity: ${profile.recentActivity.join('; ')}

## Sender Context
${resumeContext || 'Not provided'}

## Intent
The sender wants to connect for: ${intentLabels[intent]}

## Instructions
Generate a JSON object with this structure:
{
  "message": "<personalized connection message under 280 characters>",
  "hashtags": ["<relevant>", "<hashtag>", "<topics>"]
}

Rules:
- Message MUST be under 280 characters
- Be genuine and specific — reference something from their profile
- Avoid generic phrases like "I'd love to connect"
- Include a clear value proposition or shared interest
- 2-4 hashtags related to the conversation topic
- Return ONLY valid JSON, no markdown`;
}
