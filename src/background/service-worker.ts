import type { MessageType, MessageResponse, MatchResult, ConnectMessage, SalaryResult, SalaryCacheEntry } from '../lib/types';
import { getStorage, setStorage, hashString, enforceMatchCacheLimit, enforceSalaryCacheLimit, sweepCaches } from '../lib/storage';
import { buildMatchPrompt, buildConnectPrompt } from '../lib/prompts';
import salaryFallback from '../data/salary-fallback.json';
import locationCurrency from '../../middleware/data/location-currency.json';

// ── Startup: sweep stale cache entries ──
sweepCaches().then(() => {
  console.log('[LinkedIntel] Cache sweep complete');
}).catch(() => {});

// ── Middleware base URL ──
const API_BASE = 'http://localhost:3099/api';

// ── In-flight request deduplication ──
const inflightRequests = new Map<string, Promise<any>>();

function deduplicatedFetch<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflightRequests.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fn().finally(() => {
    inflightRequests.delete(key);
  });
  inflightRequests.set(key, promise);
  return promise;
}

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

    // SALARY_LOOKUP: handle async and relay results to popup as SALARY_LOOKUP_RESULT
    if (message.type === 'SALARY_LOOKUP') {
      handleSalaryLookup(message.payload).then((result) => {
        chrome.runtime.sendMessage({
          type: 'SALARY_LOOKUP_RESULT',
          payload: result.data,
        }).catch(() => {});
        sendResponse(result);
      }).catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }

    // AI_ESTIMATE_SALARY: force AI estimate for a single job
    if (message.type === 'AI_ESTIMATE_SALARY') {
      const { title, company, location, cardIndex } = message.payload;
      handleAiEstimate(title, company, location).then((result) => {
        chrome.runtime.sendMessage({
          type: 'AI_ESTIMATE_RESULT',
          payload: { result, cardIndex },
        }).catch(() => {});
        sendResponse({ success: true, data: result });
      }).catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
      return true;
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
    const result = await deduplicatedFetch(`match:${cacheKey}`, async () => {
      const prompt = buildMatchPrompt(payload.resumeText, payload.jdText);

      const response = await fetch(`${API_BASE}/gemini-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${response.status}`);
      }

      return response.json() as Promise<MatchResult>;
    });

    result.cachedAt = Date.now();
    matchCache[cacheKey] = result;
    await setStorage({ matchCache: enforceMatchCacheLimit(matchCache) });

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
    const dedupeKey = `connect:${payload.profile?.name}:${payload.intent}`;
    const result = await deduplicatedFetch(dedupeKey, async () => {
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
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${response.status}`);
      }

      return response.json() as Promise<ConnectMessage>;
    });

    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ── Salary lookup with caching ──
const SALARY_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for DB results
const SALARY_NOT_FOUND_TTL = 60 * 60 * 1000; // 1 hour for "not found" results
const SALARY_AI_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days for AI estimates

function makeSalaryCacheKey(job: { title: string; company: string; location: string }): string {
  return hashString(`${job.title}|${job.company}|${job.location}`.toLowerCase());
}

// ── Country resolution from LinkedIn location strings ──
const COUNTRY_NAMES: Record<string, string> = {
  india: 'IN', 'united states': 'US', usa: 'US', 'united kingdom': 'GB', uk: 'GB',
  canada: 'CA', germany: 'DE', singapore: 'SG', 'united arab emirates': 'AE', uae: 'AE',
  australia: 'AU', netherlands: 'NL', 'the netherlands': 'NL', ireland: 'IE',
  france: 'FR', switzerland: 'CH', sweden: 'SE',
};

const US_STATE_ABBREVS: Record<string, string> = {
  ca: 'US', ny: 'US', wa: 'US', tx: 'US', ma: 'US', co: 'US',
  il: 'US', ga: 'US', or: 'US', va: 'US', nc: 'US', pa: 'US',
  fl: 'US', oh: 'US', mi: 'US', mn: 'US', az: 'US', nj: 'US',
  ct: 'US', md: 'US', dc: 'US',
};

const cityToCountry = (locationCurrency as any).cities as Record<string, string>;
const stateToCountry = (locationCurrency as any).states as Record<string, string>;

function resolveCountryFromLocation(locationStr: string): string {
  if (!locationStr) return '';
  const raw = locationStr.toLowerCase().replace(/\(.*?\)/g, '').trim();
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);

  // Check last part for country name
  if (parts.length > 0) {
    const last = parts[parts.length - 1];
    if (COUNTRY_NAMES[last]) return COUNTRY_NAMES[last];
  }

  // Check second part for US state abbreviation or full state name
  if (parts.length >= 2) {
    const second = parts[1];
    if (US_STATE_ABBREVS[second]) return US_STATE_ABBREVS[second];
    if (stateToCountry[second]) return stateToCountry[second];
  }

  // Check first part (city) against known cities
  if (parts.length > 0 && cityToCountry[parts[0]]) {
    return cityToCountry[parts[0]];
  }

  // Check all parts against known cities
  for (const part of parts) {
    if (cityToCountry[part]) return cityToCountry[part];
  }

  return '';
}

// Fallback: simple local matching from bundled dataset
function fallbackLookup(title: string, company: string, location: string): SalaryResult {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const normTitle = norm(title);
  const normCompany = norm(company);
  const city = norm(location.split(',')[0]);
  const country = resolveCountryFromLocation(location);

  const fallbackData = salaryFallback as Array<{
    title: string; titleNormalized: string; company: string;
    city: string; country: string; salaryMin: number; salaryMax: number;
    salaryMedian: number; currency: string; source: string;
  }>;

  // Tier 1: title + company + country
  let match = fallbackData.find(
    (e) => e.titleNormalized === normTitle && norm(e.company) === normCompany && normCompany !== ''
      && (!country || e.country === country)
  );
  if (match) {
    return {
      found: true, salaryMin: match.salaryMin, salaryMax: match.salaryMax,
      salaryMedian: match.salaryMedian, currency: match.currency,
      matchType: 'company_average', isAiEstimate: false,
      label: formatFallbackLabel(match.salaryMin, match.salaryMax, match.currency),
    };
  }

  // Tier 2: title + city
  match = fallbackData.find(
    (e) => e.titleNormalized === normTitle && e.city === city && city !== ''
  );
  if (match) {
    return {
      found: true, salaryMin: match.salaryMin, salaryMax: match.salaryMax,
      salaryMedian: match.salaryMedian, currency: match.currency,
      matchType: 'market_average', isAiEstimate: false,
      label: formatFallbackLabel(match.salaryMin, match.salaryMax, match.currency),
    };
  }

  // Tier 3: title + country
  if (country) {
    match = fallbackData.find(
      (e) => e.titleNormalized === normTitle && e.country === country
    );
    if (match) {
      return {
        found: true, salaryMin: match.salaryMin, salaryMax: match.salaryMax,
        salaryMedian: match.salaryMedian, currency: match.currency,
        matchType: 'national_average', isAiEstimate: false,
        label: formatFallbackLabel(match.salaryMin, match.salaryMax, match.currency),
      };
    }
  }

  // Tier 4: title only (last resort)
  match = fallbackData.find((e) => e.titleNormalized === normTitle);
  if (match) {
    return {
      found: true, salaryMin: match.salaryMin, salaryMax: match.salaryMax,
      salaryMedian: match.salaryMedian, currency: match.currency,
      matchType: 'national_average', isAiEstimate: false,
      label: formatFallbackLabel(match.salaryMin, match.salaryMax, match.currency),
    };
  }

  return { found: false, label: 'Data Unavailable' };
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$',
  SGD: 'S$', AED: 'AED ', SEK: 'kr', CHF: 'CHF ',
};

function formatFallbackLabel(min: number, max: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] || `${currency} `;
  const fmt = (n: number) => {
    if (currency === 'INR') {
      if (n >= 100000) return `${sym}${(n / 100000).toFixed(1)}L`;
      return `${sym}${Math.round(n / 1000)}k`;
    }
    return `${sym}${Math.round(n / 1000)}k`;
  };
  if (min === max) return fmt(min);
  return `${fmt(min)} - ${fmt(max)}`;
}

async function handleSalaryLookup(
  payload: { jobs: { title: string; company: string; location: string }[] }
): Promise<MessageResponse<{ results: SalaryResult[] }>> {
  const { jobs } = payload;
  const { salaryCache } = await getStorage(['salaryCache']);

  // Check cache for each job
  const uncachedJobs: { index: number; job: typeof jobs[0] }[] = [];
  const results: SalaryResult[] = new Array(jobs.length);

  for (let i = 0; i < jobs.length; i++) {
    const key = makeSalaryCacheKey(jobs[i]);
    const cached = salaryCache[key];
    if (cached) {
      const entry = cached.results[0];
      const ttl = entry?.isAiEstimate ? SALARY_AI_CACHE_TTL
        : entry?.found ? SALARY_CACHE_TTL
        : SALARY_NOT_FOUND_TTL;
      if (Date.now() - cached.cachedAt < ttl) {
        results[i] = entry;
        continue;
      }
    }
    uncachedJobs.push({ index: i, job: jobs[i] });
  }

  // If all cached, return immediately
  if (uncachedJobs.length === 0) {
    return { success: true, data: { results } };
  }

  // Call API for uncached jobs
  try {
    const response = await fetch(`${API_BASE}/salary-lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobs: uncachedJobs.map((u) => u.job) }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const apiData: { results: SalaryResult[] } = await response.json();

    // Merge API results and cache them
    for (let i = 0; i < uncachedJobs.length; i++) {
      const { index, job } = uncachedJobs[i];
      const result = apiData.results[i];
      results[index] = result;

      const key = makeSalaryCacheKey(job);
      salaryCache[key] = { results: [result], cachedAt: Date.now() };
    }

    await setStorage({ salaryCache: enforceSalaryCacheLimit(salaryCache) });
    return { success: true, data: { results } };
  } catch {
    // API failed — use local fallback
    for (const { index, job } of uncachedJobs) {
      results[index] = fallbackLookup(job.title, job.company, job.location);
    }
    return { success: true, data: { results } };
  }
}

// ── Single AI salary estimate (on-demand, triggered by user click) ──
async function handleAiEstimate(
  title: string, company: string, location: string
): Promise<SalaryResult> {
  try {
    const response = await fetch(`${API_BASE}/salary-lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobs: [{ title, company, location }], forceAi: true }),
    });

    if (!response.ok) {
      const isRateLimit = response.status === 429;
      throw new Error(isRateLimit ? 'RATE_LIMITED' : `API error: ${response.status}`);
    }

    const apiData: { results: SalaryResult[] } = await response.json();
    const result = apiData.results[0];

    // Cache it
    const { salaryCache } = await getStorage(['salaryCache']);
    const key = makeSalaryCacheKey({ title, company, location });
    salaryCache[key] = { results: [result], cachedAt: Date.now() };
    await setStorage({ salaryCache: enforceSalaryCacheLimit(salaryCache) });

    return result;
  } catch (err) {
    const isRateLimit = (err as Error).message === 'RATE_LIMITED';
    return {
      found: false,
      label: isRateLimit ? 'Rate Limited' : 'Estimate Failed',
      isAiEstimate: true,
      rateLimited: isRateLimit,
    };
  }
}
