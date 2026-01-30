import type { ProfileData } from '../../lib/types';

const PROFILE_SELECTORS = {
  name: 'h1.text-heading-xlarge, h1.inline, .pv-text-details__left-panel h1',
  headline: '.text-body-medium.break-words, div.text-body-medium',
  about: '#about ~ .display-flex .pv-shared-text-with-see-more span.visually-hidden, section.pv-about-section .pv-about__summary-text, [data-generated-suggestion-target*="about"] .full-width span[aria-hidden="true"]',
  currentCompany: '.pv-text-details__right-panel .inline-show-more-text',
};

export function scrapeProfile(): ProfileData | null {
  const nameEl = document.querySelector(PROFILE_SELECTORS.name);
  if (!nameEl) return null;

  const headlineEl = document.querySelector(PROFILE_SELECTORS.headline);
  const aboutEl = document.querySelector(PROFILE_SELECTORS.about);
  const companyEl = document.querySelector(PROFILE_SELECTORS.currentCompany);

  // Scrape recent activity posts
  const activityEls = document.querySelectorAll(
    '.pv-recent-activity-section .feed-shared-update-v2__description, .pvs-list__item--line-2'
  );
  const recentActivity: string[] = [];
  activityEls.forEach((el, i) => {
    if (i < 3) {
      const text = el.textContent?.trim();
      if (text) recentActivity.push(text);
    }
  });

  return {
    name: nameEl.textContent?.trim() || 'Unknown',
    headline: headlineEl?.textContent?.trim() || '',
    about: aboutEl?.textContent?.trim() || '',
    recentActivity,
    currentCompany: companyEl?.textContent?.trim() || '',
    profileUrl: window.location.href,
  };
}
