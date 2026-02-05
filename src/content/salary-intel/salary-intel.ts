import { scrapeJobCards } from './job-card-scraper';
import { scrapeJobDescription } from '../reality-check/jd-scraper';
import { observePageChanges } from '../shared/dom-observer';
import { detectPage } from '../shared/page-detector';
import type { SalaryCardData } from '../../lib/types';

let isProcessing = false;

async function processFeed() {
  if (isProcessing) return;
  if (detectPage() !== 'job-search') return;

  const { showSalaryBadges } = await chrome.storage.local.get('showSalaryBadges');
  if (showSalaryBadges === false) return;

  isProcessing = true;
  try {
    const cards = scrapeJobCards();

    if (cards.length > 0) {
      // Send raw job data to service worker for backend lookup
      // Also send initial PAGE_DATA with placeholder salaries so popup shows cards immediately
      const salaryCards: SalaryCardData[] = cards.map((card) => ({
        title: card.title,
        company: card.company,
        location: card.location,
        salary: { found: false, label: 'Looking up...' },
      }));

      chrome.runtime.sendMessage({
        type: 'PAGE_DATA',
        payload: { page: 'job-search', salaryCards },
      });

      // Request salary lookup from service worker → backend API
      chrome.runtime.sendMessage({
        type: 'SALARY_LOOKUP',
        payload: {
          jobs: cards.map((c) => ({
            title: c.title,
            company: c.company,
            location: c.location,
          })),
        },
      });
    }
  } finally {
    isProcessing = false;
  }
}

// Handle scrape for job-detail pages when this script is already loaded
// (SPA navigation from /jobs/search/ to /jobs/view/ doesn't inject reality-check.js)
function scrapeJobDetail() {
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
    const page = detectPage();
    if (page === 'job-search') {
      processFeed();
    } else if (page === 'job-detail') {
      scrapeJobDetail();
    }
  }
});

// Initial scan
processFeed();

// Periodic rescan for new cards (infinite scroll) — every 5 seconds
setInterval(processFeed, 5000);

// Re-initialize on SPA navigation
observePageChanges(() => {
  setTimeout(() => {
    const page = detectPage();
    if (page === 'job-search') {
      processFeed();
    } else if (page === 'job-detail') {
      scrapeJobDetail();
    }
  }, 2000);
});
