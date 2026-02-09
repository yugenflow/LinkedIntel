import { describe, it, expect } from 'vitest';
import { hashString, enforceMatchCacheLimit, enforceSalaryCacheLimit } from '@/lib/storage';
import type { MatchResult, SalaryCacheEntry } from '@/lib/types';

describe('hashString', () => {
  it('produces consistent hashes', () => {
    expect(hashString('hello')).toBe(hashString('hello'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashString('hello')).not.toBe(hashString('world'));
  });

  it('handles empty string', () => {
    expect(hashString('')).toBe('0');
  });
});

describe('enforceMatchCacheLimit', () => {
  it('returns cache unchanged when under limit', () => {
    const cache: Record<string, MatchResult> = {
      key1: {
        matchPercent: 80,
        status: 'strong',
        summary: 'Good match',
        matchedSkills: ['React'],
        missingSkills: [],
        cachedAt: Date.now(),
      },
    };
    expect(enforceMatchCacheLimit(cache)).toBe(cache);
  });

  it('evicts oldest entries when over 100 limit', () => {
    const cache: Record<string, MatchResult> = {};
    for (let i = 0; i < 105; i++) {
      cache[`key${i}`] = {
        matchPercent: 50,
        status: 'moderate',
        summary: '',
        matchedSkills: [],
        missingSkills: [],
        cachedAt: i,
      };
    }
    const trimmed = enforceMatchCacheLimit(cache);
    expect(Object.keys(trimmed).length).toBe(100);
    // Oldest (cachedAt 0-4) should be evicted
    expect(trimmed['key0']).toBeUndefined();
    expect(trimmed['key4']).toBeUndefined();
    // Newest should remain
    expect(trimmed['key104']).toBeDefined();
  });
});

describe('enforceSalaryCacheLimit', () => {
  it('returns cache unchanged when under limit', () => {
    const cache: Record<string, SalaryCacheEntry> = {
      key1: { results: [], cachedAt: Date.now() },
    };
    expect(enforceSalaryCacheLimit(cache)).toBe(cache);
  });

  it('evicts oldest entries when over 500 limit', () => {
    const cache: Record<string, SalaryCacheEntry> = {};
    for (let i = 0; i < 505; i++) {
      cache[`key${i}`] = { results: [], cachedAt: i };
    }
    const trimmed = enforceSalaryCacheLimit(cache);
    expect(Object.keys(trimmed).length).toBe(500);
    expect(trimmed['key0']).toBeUndefined();
    expect(trimmed['key504']).toBeDefined();
  });
});
