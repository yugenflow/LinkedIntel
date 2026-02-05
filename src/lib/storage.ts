import type { StorageData } from './types';

const DEFAULTS: StorageData = {
  resume: null,
  showSalaryBadges: true,
  enableSmartConnect: true,
  matchCache: {},
  salaryCache: {},
};

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
