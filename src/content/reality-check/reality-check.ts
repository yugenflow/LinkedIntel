import { scrapeJobDescription } from './jd-scraper';
import { observePageChanges } from '../shared/dom-observer';
import { detectPage } from '../shared/page-detector';

function scrapeAndSend() {
  if (detectPage() !== 'job-detail') return;

  const jd = scrapeJobDescription();
  if (!jd || !jd.description) return;

  chrome.runtime.sendMessage({
    type: 'PAGE_DATA',
    payload: { page: 'job-detail', jd },
  });
}

// Listen for scrape requests from popup
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'REQUEST_SCRAPE') {
    scrapeAndSend();
  }
});

// Initial scrape (with delay for DOM to settle)
setTimeout(scrapeAndSend, 1500);

// Re-scrape on SPA navigation
observePageChanges((url) => {
  if (/linkedin\.com\/jobs\/view\//.test(url)) {
    setTimeout(scrapeAndSend, 1500);
  }
});
