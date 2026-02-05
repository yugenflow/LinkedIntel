/**
 * Tiered salary matcher — looks up salary from the DB using cascading strategies.
 *
 * Tiers:
 *  1. exact     — title + company + city
 *  2. company   — title + company (same country)
 *  3. city      — title + city (any company)
 *  4. country   — title + country
 *  5. fuzzy     — 60% word-overlap on title within same country
 *  5b. role-keyword — extract core role keyword (Manager, Engineer, etc.) + country
 *  6. (caller handles Gemini fallback)
 */

const fs = require('fs');
const path = require('path');
const { resolveLocation } = require('./location-resolver');

// Load title aliases for fuzzy matching
const aliases = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', 'data-sources', 'title-aliases.json'), 'utf8')
);

// Build reverse alias map
const aliasMap = {};
for (const [canonical, alts] of Object.entries(aliases)) {
  aliasMap[canonical] = canonical;
  for (const alt of alts) {
    aliasMap[alt.toLowerCase()] = canonical;
  }
}

// Load salary DB
let salaryDB = [];
const DB_PATH = path.join(__dirname, '..', 'data', 'salary-db.json');
try {
  salaryDB = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  console.log(`[salary-matcher] Loaded ${salaryDB.length} entries`);
} catch {
  console.warn('[salary-matcher] salary-db.json not found — run: node scripts/build-salary-db.js');
}

const locationData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'location-currency.json'), 'utf8')
);

// ── Company name cleaning ──
// Country suffixes that LinkedIn appends to company names
const COMPANY_COUNTRY_SUFFIXES = [
  'india', 'in india', 'india pvt ltd', 'india private limited', 'india ltd',
  'india limited', 'technologies india', 'india technologies',
  'usa', 'us', 'uk', 'global', 'international', 'worldwide',
  'pvt ltd', 'private limited', 'limited', 'ltd', 'inc', 'corp',
  'corporation', 'llc', 'llp', 'solutions', 'services', 'consulting',
  'technologies', 'technology', 'tech',
];

function cleanCompanyName(raw) {
  let name = raw.toLowerCase().replace(/[^a-z0-9\s&]/g, '').replace(/\s+/g, ' ').trim();

  // Strip trailing suffixes iteratively (longest first)
  const sorted = [...COMPANY_COUNTRY_SUFFIXES].sort((a, b) => b.length - a.length);
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of sorted) {
      if (name.endsWith(' ' + suffix)) {
        name = name.slice(0, -(suffix.length + 1)).trim();
        changed = true;
        break;
      }
      // Also handle "in <country>" pattern: "Accenture in India"
      if (name.includes(' in ' + suffix)) {
        name = name.split(' in ' + suffix)[0].trim();
        changed = true;
        break;
      }
    }
  }

  return name;
}

/**
 * Check if scraped company matches a DB company.
 * Tries: exact → cleaned → contains → prefix.
 */
function companyMatches(dbCompany, scrapedCompany) {
  if (!dbCompany || !scrapedCompany) return !dbCompany && !scrapedCompany;

  const dbClean = cleanCompanyName(dbCompany);
  const scrapedClean = cleanCompanyName(scrapedCompany);

  // Exact after cleaning
  if (dbClean === scrapedClean) return true;

  // One contains the other (handles "JP Morgan Chase" vs "JP Morgan")
  if (dbClean.includes(scrapedClean) || scrapedClean.includes(dbClean)) return true;

  // First word match for short company names (Google, Meta, etc.)
  const dbFirst = dbClean.split(' ')[0];
  const scrapedFirst = scrapedClean.split(' ')[0];
  if (dbFirst.length >= 3 && dbFirst === scrapedFirst) return true;

  return false;
}

// ── Title normalization ──
function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Clean a LinkedIn job title — strips internal codes, prefixes, and junk.
 * "#ACN S&C-GN-Strategy-Corporate Strategy & Growth - Manager" → "corporate strategy growth manager"
 * "IN_Senior Associate_GTM Strategy..." → "senior associate gtm strategy"
 */
function cleanTitle(raw) {
  let title = raw;

  // LinkedIn often sends "Title\n\n\nTitle with verification" — take first line
  const lines = title.split(/\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    title = lines[0];
  }

  // Strip "with verification" suffix LinkedIn sometimes adds
  title = title.replace(/\s+with\s+verification\s*$/i, '');

  // Strip leading codes like "#ACN", "IN_", "US_"
  title = title.replace(/^#?\w{2,5}[\s_-]+/i, '');

  // Strip "IN_", "US_" style prefix codes (e.g., "IN_Senior Associate_GTM...")
  title = title.replace(/^[A-Z]{2}_/i, '');

  // Replace underscores and multiple dashes with spaces
  title = title.replace(/[_]+/g, ' ').replace(/\s*-\s*/g, ' ');

  // Strip parenthetical content
  title = title.replace(/\(.*?\)/g, '');

  const normalized = normalize(title);

  // Safety: if the title still looks duplicated (two halves are identical), take first half
  const words = normalized.split(' ');
  if (words.length >= 4 && words.length % 2 === 0) {
    const half = words.length / 2;
    const firstHalf = words.slice(0, half).join(' ');
    const secondHalf = words.slice(half).join(' ');
    if (firstHalf === secondHalf) return firstHalf;
  }

  return normalized;
}

function normalizeTitle(raw) {
  const cleaned = cleanTitle(raw);

  // Direct alias lookup
  if (aliasMap[cleaned]) return aliasMap[cleaned];

  // Try matching against aliases as substrings
  // Sort aliases by length (longest first) to prefer more specific matches
  const aliasEntries = Object.entries(aliasMap).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, canonical] of aliasEntries) {
    if (alias.length >= 4 && cleaned.includes(alias)) return canonical;
  }

  return cleaned;
}

// Core role keywords for last-resort matching
const ROLE_KEYWORDS = [
  'engineer', 'developer', 'manager', 'analyst', 'scientist',
  'designer', 'architect', 'consultant', 'director', 'lead',
  'administrator', 'writer', 'master', 'executive',
];

/**
 * Extract the core role from a title for last-resort matching.
 * "Technical Strategy and Operations Manager" → looks for DB entries with "manager" in title
 */
function extractCoreRole(normalizedTitle) {
  const words = normalizedTitle.split(' ');
  for (const keyword of ROLE_KEYWORDS) {
    if (words.includes(keyword)) return keyword;
  }
  return null;
}

function wordOverlap(a, b) {
  const wordsA = a.split(' ').filter((w) => w.length > 2);
  const wordsB = b.split(' ').filter((w) => w.length > 2);
  if (wordsA.length === 0) return 0;
  const matched = wordsA.filter((w) => wordsB.includes(w)).length;
  return matched / wordsA.length;
}

function average(entries) {
  const len = entries.length;
  return {
    salaryMin: Math.round(entries.reduce((s, e) => s + e.salaryMin, 0) / len),
    salaryMax: Math.round(entries.reduce((s, e) => s + e.salaryMax, 0) / len),
    salaryMedian: Math.round(entries.reduce((s, e) => s + e.salaryMedian, 0) / len),
    currency: entries[0].currency,
    source: entries[0].source,
    sampleSize: len,
  };
}

function formatLabel(min, max, currency, format) {
  const fmt = (n) => {
    const sym = (locationData.countries[currencyToCountry(currency)] || {}).symbol || currency;
    if (format === 'lakh') {
      if (n >= 100000) return `${sym}${(n / 100000).toFixed(1)}L`;
      return `${sym}${Math.round(n / 1000)}k`;
    }
    if (n >= 1000) return `${sym}${Math.round(n / 1000)}k`;
    return `${sym}${n}`;
  };
  if (min === max) return fmt(min);
  return `${fmt(min)} - ${fmt(max)}`;
}

function currencyToCountry(currency) {
  for (const [code, info] of Object.entries(locationData.countries)) {
    if (info.currency === currency) return code;
  }
  return '';
}

/**
 * Look up salary for a single job.
 */
function matchSalary(title, company, locationStr) {
  const normTitle = normalizeTitle(title);
  const loc = resolveLocation(locationStr);
  const format = loc.format || 'k';

  console.log(`[match] title="${title}" → normalized="${normTitle}" | company="${company}" → cleaned="${cleanCompanyName(company)}" | city="${loc.city}" country="${loc.country}"`);

  // Tier 1: Exact — title + company + city
  const exact = salaryDB.filter(
    (e) =>
      e.titleNormalized === normTitle &&
      companyMatches(e.company, company) &&
      company.trim() !== '' &&
      e.city === loc.city
  );
  if (exact.length > 0) {
    const avg = average(exact);
    return {
      found: true,
      ...avg,
      matchType: 'exact',
      isAiEstimate: false,
      label: formatLabel(avg.salaryMin, avg.salaryMax, avg.currency, format),
    };
  }

  // Tier 2: Company — title + company (same country, any city)
  const companyMatch = salaryDB.filter(
    (e) =>
      e.titleNormalized === normTitle &&
      companyMatches(e.company, company) &&
      company.trim() !== '' &&
      (e.country === loc.country || !loc.country)
  );
  if (companyMatch.length > 0) {
    const avg = average(companyMatch);
    return {
      found: true,
      ...avg,
      matchType: 'company_average',
      isAiEstimate: false,
      label: formatLabel(avg.salaryMin, avg.salaryMax, avg.currency, format),
    };
  }

  // Tier 3: City — title + city (any company)
  const cityMatch = salaryDB.filter(
    (e) => e.titleNormalized === normTitle && e.city === loc.city && loc.city !== ''
  );
  if (cityMatch.length > 0) {
    const avg = average(cityMatch);
    return {
      found: true,
      ...avg,
      matchType: 'market_average',
      isAiEstimate: false,
      label: formatLabel(avg.salaryMin, avg.salaryMax, avg.currency, format),
    };
  }

  // Tier 4: Country — title + country
  const countryMatch = salaryDB.filter(
    (e) => e.titleNormalized === normTitle && e.country === loc.country && loc.country !== ''
  );
  if (countryMatch.length > 0) {
    const avg = average(countryMatch);
    return {
      found: true,
      ...avg,
      matchType: 'national_average',
      isAiEstimate: false,
      label: formatLabel(avg.salaryMin, avg.salaryMax, avg.currency, format),
    };
  }

  // Tier 5: Fuzzy title within same country (word overlap >= 60%)
  const fuzzy = salaryDB.filter(
    (e) =>
      wordOverlap(normTitle, e.titleNormalized) >= 0.6 &&
      (e.country === loc.country || !loc.country)
  );
  if (fuzzy.length > 0) {
    const avg = average(fuzzy);
    return {
      found: true,
      ...avg,
      matchType: 'fuzzy_average',
      isAiEstimate: false,
      label: formatLabel(avg.salaryMin, avg.salaryMax, avg.currency, format),
    };
  }

  // Tier 5b: Role-keyword match — extract core role + company or country
  const coreRole = extractCoreRole(normTitle);
  if (coreRole) {
    // Try with company first
    const roleCompany = salaryDB.filter(
      (e) =>
        e.titleNormalized.split(' ').includes(coreRole) &&
        companyMatches(e.company, company) &&
        company.trim() !== '' &&
        (e.country === loc.country || !loc.country)
    );
    if (roleCompany.length > 0) {
      const avg = average(roleCompany);
      return {
        found: true,
        ...avg,
        matchType: 'fuzzy_average',
        isAiEstimate: false,
        label: formatLabel(avg.salaryMin, avg.salaryMax, avg.currency, format),
      };
    }

    // Try with city
    const roleCity = salaryDB.filter(
      (e) =>
        e.titleNormalized.split(' ').includes(coreRole) &&
        e.city === loc.city &&
        loc.city !== ''
    );
    if (roleCity.length > 0) {
      const avg = average(roleCity);
      return {
        found: true,
        ...avg,
        matchType: 'fuzzy_average',
        isAiEstimate: false,
        label: formatLabel(avg.salaryMin, avg.salaryMax, avg.currency, format),
      };
    }

    // Try with country only
    const roleCountry = salaryDB.filter(
      (e) =>
        e.titleNormalized.split(' ').includes(coreRole) &&
        (e.country === loc.country || !loc.country)
    );
    if (roleCountry.length > 0) {
      const avg = average(roleCountry);
      return {
        found: true,
        ...avg,
        matchType: 'fuzzy_average',
        isAiEstimate: false,
        label: formatLabel(avg.salaryMin, avg.salaryMax, avg.currency, format),
      };
    }
  }

  // No match — caller should try Gemini fallback
  return {
    found: false,
    matchType: 'none',
    isAiEstimate: false,
    label: 'Data Unavailable',
    currency: loc.currency || '',
    location: loc,
  };
}

/**
 * Batch lookup for multiple jobs.
 */
function matchSalaries(jobs) {
  return jobs.map((job) => matchSalary(job.title, job.company, job.location));
}

module.exports = { matchSalary, matchSalaries, normalizeTitle };
