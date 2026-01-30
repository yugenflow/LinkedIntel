/**
 * Lightweight SPA navigation detection.
 * Uses only URL polling — no MutationObservers on document.body.
 */

type PageChangeCallback = (url: string) => void;

export function observePageChanges(callback: PageChangeCallback): () => void {
  let lastUrl = window.location.href;

  const interval = setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      callback(currentUrl);
    }
  }, 2000);

  return () => clearInterval(interval);
}

/**
 * Wait for an element to appear in the DOM.
 * Uses polling instead of MutationObserver to avoid performance issues.
 */
export function waitForElement(
  selector: string,
  timeout = 10000
): Promise<Element | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(interval);
        resolve(el);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(interval);
        resolve(null);
      }
    }, 500);
  });
}
