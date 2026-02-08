import type { StorageData, MatchResult, SalaryCacheEntry } from './types';

const DEFAULTS: StorageData = {
  resume: null,
  showSalaryBadges: true,
  enableSmartConnect: true,
  matchCache: {},
  salaryCache: {},
};

// ── Cache limits ──
const MATCH_CACHE_MAX = 100;
const SALARY_CACHE_MAX = 500;
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// Bump this when salary DB changes to invalidate stale cached results
const SALARY_DB_VERSION = 2;

export async function getStorage<K extends keyof StorageData>(
  keys: K[]
): Promise<Pick<StorageData, K>> {
  const result = await chrome.storage.local.get(keys);
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    out[key] = result[key] ?? DEFAULTS[key];
  }
  return out as Pick<StorageData, K>;
}

export async function setStorage(data: Partial<StorageData>): Promise<void> {
  await chrome.storage.local.set(data);
}

export async function clearStorage(): Promise<void> {
  await chrome.storage.local.clear();
}

/** Generate a simple hash for cache keys */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

// ── Cache management ──

/** Evict oldest entries from match cache if over limit */
export function enforceMatchCacheLimit(
  cache: Record<string, MatchResult>
): Record<string, MatchResult> {
  const entries = Object.entries(cache);
  if (entries.length <= MATCH_CACHE_MAX) return cache;

  // Sort by cachedAt ascending (oldest first), evict oldest
  entries.sort((a, b) => (a[1].cachedAt || 0) - (b[1].cachedAt || 0));
  const keep = entries.slice(entries.length - MATCH_CACHE_MAX);
  return Object.fromEntries(keep);
}

/** Evict oldest entries from salary cache if over limit */
export function enforceSalaryCacheLimit(
  cache: Record<string, SalaryCacheEntry>
): Record<string, SalaryCacheEntry> {
  const entries = Object.entries(cache);
  if (entries.length <= SALARY_CACHE_MAX) return cache;

  entries.sort((a, b) => (a[1].cachedAt || 0) - (b[1].cachedAt || 0));
  const keep = entries.slice(entries.length - SALARY_CACHE_MAX);
  return Object.fromEntries(keep);
}

/**
 * Sweep both caches: remove entries older than 7 days and enforce size limits.
 * Also invalidates the entire salary cache when the DB version changes.
 * Call on service worker startup.
 */
export async function sweepCaches(): Promise<void> {
  const { matchCache, salaryCache } = await getStorage(['matchCache', 'salaryCache']);
  const now = Date.now();
  let changed = false;

  // Check DB version — if it changed, clear entire salary cache
  const stored = await chrome.storage.local.get('salaryDbVersion');
  if (stored.salaryDbVersion !== SALARY_DB_VERSION) {
    console.log(`[LinkedIntel] Salary DB version changed (${stored.salaryDbVersion} → ${SALARY_DB_VERSION}), clearing salary cache`);
    await chrome.storage.local.set({ salaryDbVersion: SALARY_DB_VERSION, salaryCache: {} });
    // Still need to sweep match cache below
    const trimmedMatch = enforceMatchCacheLimit(matchCache);
    await setStorage({ matchCache: trimmedMatch });
    return;
  }

  // Purge expired match entries
  for (const key of Object.keys(matchCache)) {
    if (now - (matchCache[key].cachedAt || 0) > CACHE_MAX_AGE) {
      delete matchCache[key];
      changed = true;
    }
  }

  // Purge expired salary entries
  for (const key of Object.keys(salaryCache)) {
    if (now - (salaryCache[key].cachedAt || 0) > CACHE_MAX_AGE) {
      delete salaryCache[key];
      changed = true;
    }
  }

  // Enforce size limits after purge
  const trimmedMatch = enforceMatchCacheLimit(matchCache);
  const trimmedSalary = enforceSalaryCacheLimit(salaryCache);

  if (changed || trimmedMatch !== matchCache || trimmedSalary !== salaryCache) {
    await setStorage({ matchCache: trimmedMatch, salaryCache: trimmedSalary });
  }
}
