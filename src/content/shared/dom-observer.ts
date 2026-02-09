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
