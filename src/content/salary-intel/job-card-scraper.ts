const CARD_SELECTORS = {
  card: '.job-card-container, .jobs-search-results__list-item, li.jobs-search-results__list-item',
  title: '.job-card-list__title, .job-card-container__link, a.job-card-list__title--link',
  company: '.job-card-container__primary-description, .artdeco-entity-lockup__subtitle',
  location: '.job-card-container__metadata-wrapper, .artdeco-entity-lockup__caption',
};

export interface ScrapedJobCard {
  element: Element;
  title: string;
  company: string;
  location: string;
}

export function scrapeJobCards(): ScrapedJobCard[] {
  const cards = document.querySelectorAll(CARD_SELECTORS.card);
  const results: ScrapedJobCard[] = [];

  cards.forEach((card) => {
    if (card.hasAttribute('data-linkedintel-salary')) return;

    const titleEl = card.querySelector(CARD_SELECTORS.title);
    const companyEl = card.querySelector(CARD_SELECTORS.company);
    const locationEl = card.querySelector(CARD_SELECTORS.location);

    const title = titleEl?.textContent?.trim() || '';
    const company = companyEl?.textContent?.trim() || '';
    const location = locationEl?.textContent?.trim() || '';

    if (title) {
      results.push({ element: card, title, company, location });
    }
  });

  return results;
}
