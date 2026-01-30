import { scrapeProfile } from './profile-scraper';
import { observePageChanges } from '../shared/dom-observer';
import { detectPage } from '../shared/page-detector';

async function scrapeAndSend() {
  if (detectPage() !== 'profile') return;

  const { enableSmartConnect } = await chrome.storage.local.get('enableSmartConnect');
  if (enableSmartConnect === false) return;

  const profile = scrapeProfile();
  if (!profile) return;

  chrome.runtime.sendMessage({
    type: 'PAGE_DATA',
    payload: { page: 'profile', profile },
  });
}

// Listen for scrape requests from side panel
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'REQUEST_SCRAPE') {
    scrapeAndSend();
  }
});

// Initial scrape (with delay for DOM to settle)
setTimeout(scrapeAndSend, 1500);

// Re-scrape on SPA navigation
observePageChanges((url) => {
  if (/linkedin\.com\/in\//.test(url)) {
    setTimeout(scrapeAndSend, 1500);
  }
});
