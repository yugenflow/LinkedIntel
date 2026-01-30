import type { MatchResult, ConnectMessage, ProfileData, IntentType, MessageResponse } from './types';

/**
 * Send messages to the service worker which proxies to the Vercel middleware.
 * Content scripts cannot directly call external APIs due to CORS.
 */

export async function matchResumeToJD(
  resumeText: string,
  jdText: string
): Promise<MatchResult> {
  const response = await chrome.runtime.sendMessage({
    type: 'MATCH_RESUME_JD',
    payload: { resumeText, jdText },
  });

  const msg = response as MessageResponse<MatchResult>;
  if (!msg.success) throw new Error(msg.error || 'Match failed');
  return msg.data!;
}

export async function generateIcebreaker(
  profile: ProfileData,
  intent: IntentType,
  resumeContext?: string
): Promise<ConnectMessage> {
  const response = await chrome.runtime.sendMessage({
    type: 'GENERATE_ICEBREAKER',
    payload: { profile, intent, resumeContext },
  });

  const msg = response as MessageResponse<ConnectMessage>;
  if (!msg.success) throw new Error(msg.error || 'Generation failed');
  return msg.data!;
}
