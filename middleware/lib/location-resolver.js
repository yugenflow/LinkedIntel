/**
 * Parse a LinkedIn location string into structured { city, state, country, currency }.
 *
 * Examples:
 *   "Bengaluru, Karnataka, India"    → { city: "bengaluru", country: "IN", currency: "INR" }
 *   "San Francisco, CA"              → { city: "san francisco", country: "US", currency: "USD" }
 *   "Gurugram, Haryana, India"       → { city: "gurugram", country: "IN", currency: "INR" }
 */

const path = require('path');
const locationData = require(path.join(__dirname, '..', 'data', 'location-currency.json'));

const { countries, cities, states } = locationData;

// Country name → code
const COUNTRY_NAMES = {
  india: 'IN',
  'united states': 'US',
  usa: 'US',
  'united kingdom': 'GB',
  uk: 'GB',
  canada: 'CA',
  germany: 'DE',
  singapore: 'SG',
  'united arab emirates': 'AE',
  uae: 'AE',
  australia: 'AU',
  netherlands: 'NL',
  'the netherlands': 'NL',
  ireland: 'IE',
  france: 'FR',
  switzerland: 'CH',
  sweden: 'SE',
};

// US state abbreviations
const US_STATE_ABBREVS = {
  ca: 'US', ny: 'US', wa: 'US', tx: 'US', ma: 'US', co: 'US',
  il: 'US', ga: 'US', or: 'US', va: 'US', nc: 'US', pa: 'US',
  fl: 'US', oh: 'US', mi: 'US', mn: 'US', az: 'US', nj: 'US',
  ct: 'US', md: 'US', dc: 'US',
};

function resolveLocation(locationStr) {
  if (!locationStr) return { city: '', state: '', country: '', currency: '' };

  const raw = locationStr.toLowerCase().replace(/\(.*?\)/g, '').trim();
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);

  let city = '';
  let state = '';
  let countryCode = '';

  // Try to identify country from the last part
  if (parts.length > 0) {
    const last = parts[parts.length - 1];
    if (COUNTRY_NAMES[last]) {
      countryCode = COUNTRY_NAMES[last];
    }
  }

  // Try to identify city from first part
  if (parts.length > 0) {
    city = parts[0];
    if (cities[city]) {
      countryCode = countryCode || cities[city];
    }
  }

  // Try state from second part (if 3 parts: city, state, country; if 2 parts: city, state/country)
  if (parts.length >= 2) {
    const second = parts[1];
    // Check US state abbreviation
    if (US_STATE_ABBREVS[second]) {
      countryCode = countryCode || US_STATE_ABBREVS[second];
      state = second;
    } else if (states[second]) {
      countryCode = countryCode || states[second];
      state = second;
    }
  }

  // If still no country, try harder: check if any part matches a known city
  if (!countryCode) {
    for (const part of parts) {
      if (cities[part]) {
        countryCode = cities[part];
        city = part;
        break;
      }
    }
  }

  // Resolve currency
  const countryInfo = countries[countryCode] || null;
  const currency = countryInfo ? countryInfo.currency : '';

  return {
    city,
    state,
    country: countryCode,
    currency,
    symbol: countryInfo ? countryInfo.symbol : '',
    format: countryInfo ? countryInfo.format : 'k',
  };
}

module.exports = { resolveLocation };
