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

const LOCATION_SELECTORS = [
  '.jobs-unified-top-card__bullet',
  '.job-details-jobs-unified-top-card__bullet',
  '[class*="top-card"] [class*="bullet"]',
  '[class*="topcard"] [class*="bullet"]',
  '[class*="top-card"] [class*="location"]',
  '[class*="topcard"] [class*="location"]',
];

import { SALARY_PATTERN } from '../shared/constants';

const SALARY_SELECTORS = [
  '.job-details-jobs-unified-top-card__job-insight--highlight span',
  '.job-details-jobs-unified-top-card__job-insight span',
  '[class*="salary"]',
  '[class*="compensation"]',
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
  location: string;
  postedSalary?: string;
}

export function scrapeJobDescription(): ScrapedJD | null {
  const descEl = queryFirst(DESCRIPTION_SELECTORS);
  if (!descEl) return null;

  const titleEl = queryFirst(TITLE_SELECTORS) || findTitleElement();
  const companyEl = queryFirst(COMPANY_SELECTORS);
  let location = '';

  // Extract title — prefer innerText to avoid hidden duplicates
  let title = '';
  if (titleEl) {
    const inner = (titleEl as HTMLElement).innerText?.trim();
    if (inner) {
      title = inner.split('\n').map(s => s.trim()).filter(Boolean)[0] || inner;
    } else {
      title = cleanText(titleEl.textContent);
    }
  }

  const company = cleanText(companyEl?.textContent) || 'Unknown Company';

  // If DOM title is missing, too short, or matches the company name, it's likely wrong.
  // Fall back to document.title which LinkedIn always sets as "Job Title - Company | LinkedIn"
  if (!title || title.length <= 3 || title.toLowerCase() === company.toLowerCase()) {
    const fromDocTitle = getTitleFromDocumentTitle();
    if (fromDocTitle) {
      title = fromDocTitle;
    }
  }

  // Try dedicated location selectors first
  const locationEl = queryFirst(LOCATION_SELECTORS);
  if (locationEl) {
    location = cleanText(locationEl.textContent);
  }

  // Fallback: scan spans in the top card area for location-like text
  if (!location) {
    const topCardArea = document.querySelector(
      '.job-details-jobs-unified-top-card__primary-description-container, ' +
      '[class*="top-card"] [class*="primary-description"], ' +
      '[class*="top-card"], [class*="topcard"], ' +
      '[class*="job-details-jobs-unified-top-card"]'
    );
    const scanRoot = topCardArea || document.body;
    const spans = scanRoot.querySelectorAll('span, div');
    for (const el of spans) {
      // Skip the description area and nav
      if (descEl.contains(el)) continue;
      // Skip the title element (titles with commas get misidentified as locations)
      if (titleEl && (el === titleEl || titleEl.contains(el) || el.contains(titleEl))) continue;
      const text = cleanText(el.textContent);
      // Skip if text matches the already-scraped title
      if (title && text.toLowerCase() === title.toLowerCase()) continue;
      // Location pattern: contains a comma, under 60 chars, looks like "City, State, Country"
      if (text.includes(',') && text.length > 4 && text.length < 60 && !el.closest('a')) {
        // Skip if it looks like a date or number-heavy string
        if (/^\d/.test(text) || /\d{4}/.test(text)) continue;
        location = text;
        break;
      }
    }
  }

  // Strip work-type suffixes like "(On-site)", "(Remote)", "(Hybrid)"
  location = location.replace(/\s*\(.*?\)\s*$/, '').trim();

  // Scrape LinkedIn-posted salary (employer-provided salary range)
  let postedSalary: string | undefined;

  // Strategy 1: Check dedicated salary selectors
  for (const sel of SALARY_SELECTORS) {
    try {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const text = (el as HTMLElement).innerText?.trim() || el.textContent?.trim() || '';
        const match = text.match(SALARY_PATTERN);
        if (match) {
          postedSalary = match[0];
          break;
        }
      }
    } catch { /* skip invalid selector */ }
    if (postedSalary) break;
  }

  // Strategy 2: Scan the top card area for salary-like text (including buttons/pills)
  if (!postedSalary) {
    const topCard = document.querySelector(
      '.job-details-jobs-unified-top-card__container, ' +
      '[class*="jobs-unified-top-card"], [class*="topcard"], ' +
      '[class*="job-details"]'
    );
    if (topCard) {
      const elements = topCard.querySelectorAll('span, li, div, button, a');
      for (const el of elements) {
        if (descEl.contains(el)) continue;
        const text = (el as HTMLElement).innerText?.trim() || el.textContent?.trim() || '';
        if (text.length > 200) continue; // skip large blocks
        const match = text.match(SALARY_PATTERN);
        if (match) {
          postedSalary = match[0];
          break;
        }
      }
    }
  }

  // Strategy 3: Last resort — scan the entire page above the description
  if (!postedSalary) {
    const allElements = document.querySelectorAll('button, span, li');
    for (const el of allElements) {
      if (descEl.contains(el)) continue;
      const text = (el as HTMLElement).innerText?.trim() || el.textContent?.trim() || '';
      if (text.length > 80) continue;
      const match = text.match(SALARY_PATTERN);
      if (match) {
        postedSalary = match[0];
        break;
      }
    }
  }

  return {
    title: title || 'Unknown Title',
    company,
    description: cleanText(descEl.textContent) || '',
    location,
    ...(postedSalary && { postedSalary }),
  };
}

/**
 * Parse the browser's document.title for the job title.
 * LinkedIn always sets it to "Job Title - Company | LinkedIn"
 * or "(1) Job Title - Company | LinkedIn" (with notification count).
 */
function getTitleFromDocumentTitle(): string {
  const docTitle = document.title;
  // Strip notification count: "(1) Job Title..." → "Job Title..."
  const cleaned = docTitle.replace(/^\(\d+\)\s*/, '');
  // Split by " - " or " | " and take the first part
  const parts = cleaned.split(/\s+[-–—|]\s+/);
  if (parts.length >= 2) {
    return parts[0].trim();
  }
  return '';
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
