import '@testing-library/jest-dom/vitest';
import { vi, afterEach } from 'vitest';

// Track registered listeners so tests can simulate Chrome messages
const messageListeners: Function[] = [];

const chromeMock = {
  runtime: {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onMessage: {
      addListener: vi.fn((fn: Function) => messageListeners.push(fn)),
      removeListener: vi.fn((fn: Function) => {
        const idx = messageListeners.indexOf(fn);
        if (idx >= 0) messageListeners.splice(idx, 1);
      }),
    },
    getURL: vi.fn((p: string) => `chrome-extension://test-id/${p}`),
    id: 'test-extension-id',
  },
  storage: {
    local: {
      get: vi.fn().mockImplementation(async (keys: string | string[]) => {
        const defaults: Record<string, unknown> = {
          resume: null,
          showSalaryBadges: true,
          enableSmartConnect: true,
          matchCache: {},
          salaryCache: {},
          salaryDbVersion: 2,
        };
        if (typeof keys === 'string') return { [keys]: defaults[keys] };
        if (Array.isArray(keys)) {
          const result: Record<string, unknown> = {};
          for (const k of keys) result[k] = defaults[k];
          return result;
        }
        return defaults;
      }),
      set: vi.fn().mockResolvedValue(undefined),
      getBytesInUse: vi.fn().mockResolvedValue(0),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn().mockResolvedValue([{ id: 1, url: 'https://www.linkedin.com/' }]),
    sendMessage: vi.fn(),
  },
};

vi.stubGlobal('chrome', chromeMock);

// Helper for tests to simulate incoming Chrome messages
(globalThis as any).__simulateChromeMessage = (message: unknown) => {
  messageListeners.forEach((fn) => fn(message, {}, () => {}));
};

afterEach(() => {
  vi.clearAllMocks();
  messageListeners.length = 0;
});
