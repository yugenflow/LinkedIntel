import type { MessageType, MessageResponse, MatchResult, ConnectMessage } from '../lib/types';
import { getStorage, setStorage, hashString } from '../lib/storage';
import { buildMatchPrompt, buildConnectPrompt } from '../lib/prompts';

// ── Middleware base URL ──
const API_BASE = 'http://localhost:3001/api';

// ── Determine which content script to inject based on URL ──
function getContentScriptForUrl(url: string): string | null {
  if (/linkedin\.com\/jobs\/view\//.test(url)) return 'reality-check.js';
  if (/linkedin\.com\/in\//.test(url)) return 'smart-connect.js';
  if (/linkedin\.com\/jobs\/(search|collections)/.test(url) || /linkedin\.com\/jobs\/?(\?|$)/.test(url)) return 'salary-intel.js';
  return null;
}

// ── Message router ──
chrome.runtime.onMessage.addListener(
  (message: MessageType, sender, sendResponse: (response: MessageResponse) => void) => {
    // Relay PAGE_DATA from content scripts to popup
    if (message.type === 'PAGE_DATA') {
      chrome.runtime.sendMessage(message).catch(() => {
        // Popup may not be open yet — safe to ignore
      });
      sendResponse({ success: true });
      return false;
    }

    // REQUEST_SCRAPE from popup → forward to content script in active tab
    // If no content script responds, programmatically inject one
    if (message.type === 'REQUEST_SCRAPE') {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const tab = tabs[0];
        const tabId = tab?.id;
        const tabUrl = tab?.url || '';

        if (!tabId) return;

        try {
          await chrome.tabs.sendMessage(tabId, { type: 'REQUEST_SCRAPE' });
        } catch {
          // Content script not injected — try to inject it
          const script = getContentScriptForUrl(tabUrl);
          if (script) {
            try {
              await chrome.scripting.executeScript({
                target: { tabId },
                files: [script],
              });
              // Give it a moment to initialize, then request scrape
              setTimeout(() => {
                chrome.tabs.sendMessage(tabId, { type: 'REQUEST_SCRAPE' }).catch(() => {});
              }, 1000);
            } catch {
              // Injection failed (e.g., not a LinkedIn tab)
            }
          }
        }
      });
      sendResponse({ success: true });
      return false;
    }

    handleMessage(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ success: false, error: err.message }));

    // Return true to indicate async response
    return true;
  }
);

async function handleMessage(message: MessageType): Promise<MessageResponse> {
  switch (message.type) {
    case 'MATCH_RESUME_JD':
      return handleMatch(message.payload);

    case 'GENERATE_ICEBREAKER':
      return handleIcebreaker(message.payload);

    case 'GET_STORAGE': {
      const data = await getStorage(message.payload.keys as any);
      return { success: true, data };
    }

    case 'SET_STORAGE': {
      await setStorage(message.payload);
      return { success: true };
    }

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

// ── Resume vs JD matching ──
async function handleMatch(
  payload: { resumeText: string; jdText: string }
): Promise<MessageResponse<MatchResult>> {
  const cacheKey = hashString(payload.resumeText + payload.jdText);
  const { matchCache } = await getStorage(['matchCache']);
  const cached = matchCache[cacheKey];

  if (cached && Date.now() - cached.cachedAt < 24 * 60 * 60 * 1000) {
    return { success: true, data: cached };
  }

  try {
    const prompt = buildMatchPrompt(payload.resumeText, payload.jdText);

    const response = await fetch(`${API_BASE}/gemini-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result: MatchResult = await response.json();
    result.cachedAt = Date.now();

    matchCache[cacheKey] = result;
    await setStorage({ matchCache });

    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ── Icebreaker generation ──
async function handleIcebreaker(
  payload: { profile: any; intent: any; resumeContext?: string }
): Promise<MessageResponse<ConnectMessage>> {
  try {
    const prompt = buildConnectPrompt(
      payload.profile,
      payload.intent,
      payload.resumeContext
    );

    const response = await fetch(`${API_BASE}/gemini-connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result: ConnectMessage = await response.json();
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
