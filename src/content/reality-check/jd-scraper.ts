// Multiple selector strategies — LinkedIn frequently changes class names.
// We try specific selectors first, then fall back to structural/attribute queries.
const TITLE_SELECTORS = [
  '.jobs-unified-top-card__job-title',
  '.job-details-jobs-unified-top-card__job-title',
  '.job-details-jobs-unified-top-card__job-title--link',
  'h1.t-24',
  'h1.t-20',
  '[class*="top-card"] h1',
  '[class*="topcard"] h1',
  'h1',
];

const COMPANY_SELECTORS = [
  '.jobs-unified-top-card__company-name',
  '.job-details-jobs-unified-top-card__company-name',
  '.job-details-jobs-unified-top-card__primary-description-container .app-aware-link',
  '[class*="top-card"] [class*="company"]',
  '[class*="topcard"] [class*="company"]',
  '[class*="top-card"] a[href*="/company/"]',
  '[class*="topcard"] a[href*="/company/"]',
  'a[href*="/company/"]',
];

const DESCRIPTION_SELECTORS = [
  '[data-testid="expandable-text-box"]',
  '.jobs-description__content',
  '.jobs-description-content__text',
  '#job-details',
  '.jobs-box__html-content',
  '[class*="jobs-description"] [class*="content"]',
  '[class*="description__text"]',
  '.jobs-description',
  'article[class*="jobs"]',
];

function queryFirst(selectors: string[]): Element | null {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el) return el;
    } catch {
      // Invalid selector — skip
    }
  }
  return null;
}

export interface ScrapedJD {
  title: string;
  company: string;
  description: string;
}

export function scrapeJobDescription(): ScrapedJD | null {
  const descEl = queryFirst(DESCRIPTION_SELECTORS);
  if (!descEl) return null;

  const titleEl = queryFirst(TITLE_SELECTORS) || findTitleElement();
  const companyEl = queryFirst(COMPANY_SELECTORS);

  return {
    title: cleanText(titleEl?.textContent) || 'Unknown Title',
    company: cleanText(companyEl?.textContent) || 'Unknown Company',
    description: cleanText(descEl.textContent) || '',
  };
}

/**
 * Fallback title finder: looks for the first short text element
 * outside the job description area and navigation/notification regions.
 */
function findTitleElement(): Element | null {
  const descBox = document.querySelector('[data-testid="expandable-text-box"]');
  const navBar = document.querySelector('header, nav, [role="navigation"]');
  const candidates = document.querySelectorAll('p, h1, h2, h3');
  const junkPatterns = /^\d+\s*notifications?$|^messages?$|^home$|^my network$/i;
  for (const el of candidates) {
    const text = el.textContent?.trim() || '';
    if (text.length >= 3 && text.length <= 80 && !text.includes('\n')) {
      if (descBox && descBox.contains(el)) continue;
      if (navBar && navBar.contains(el)) continue;
      if (junkPatterns.test(text)) continue;
      return el;
    }
  }
  return null;
}

function cleanText(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}
