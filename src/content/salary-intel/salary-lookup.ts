import type { SalaryEntry, SalaryResult } from '../../lib/types';
import salaryData from '../../data/salary-dataset.json';

const dataset = salaryData as SalaryEntry[];

function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fuzzyMatch(needle: string, haystack: string): boolean {
  const n = normalize(needle);
  const h = normalize(haystack);
  // Check if most words from needle exist in haystack
  const words = n.split(' ').filter((w) => w.length > 2);
  if (words.length === 0) return false;
  const matchCount = words.filter((w) => h.includes(w)).length;
  return matchCount / words.length >= 0.6;
}

function extractCity(location: string): string {
  // "San Francisco, CA (Remote)" -> "san francisco"
  return normalize(location.split(',')[0].replace(/\(.*\)/, ''));
}

export function lookupSalary(
  title: string,
  company: string,
  location: string
): SalaryResult {
  const normTitle = normalize(title);
  const normCompany = normalize(company);
  const city = extractCity(location);

  // Try exact match: title + company + location
  let match = dataset.find(
    (e) =>
      fuzzyMatch(title, e.title) &&
      normalize(e.company) === normCompany &&
      normalize(e.location).includes(city)
  );

  if (match) {
    return formatResult(match, 'exact');
  }

  // Fallback: title + location (market average)
  const locationMatches = dataset.filter(
    (e) => fuzzyMatch(title, e.title) && normalize(e.location).includes(city)
  );

  if (locationMatches.length > 0) {
    const avgMin = Math.round(
      locationMatches.reduce((s, e) => s + e.salaryMin, 0) / locationMatches.length
    );
    const avgMax = Math.round(
      locationMatches.reduce((s, e) => s + e.salaryMax, 0) / locationMatches.length
    );
    return {
      found: true,
      salaryMin: avgMin,
      salaryMax: avgMax,
      currency: locationMatches[0].currency,
      matchType: 'market_average',
      label: formatSalaryLabel(avgMin, avgMax, locationMatches[0].currency),
    };
  }

  // Fallback: title only (national average)
  const titleMatches = dataset.filter((e) => fuzzyMatch(title, e.title));
  if (titleMatches.length > 0) {
    const avgMin = Math.round(
      titleMatches.reduce((s, e) => s + e.salaryMin, 0) / titleMatches.length
    );
    const avgMax = Math.round(
      titleMatches.reduce((s, e) => s + e.salaryMax, 0) / titleMatches.length
    );
    return {
      found: true,
      salaryMin: avgMin,
      salaryMax: avgMax,
      currency: titleMatches[0].currency,
      matchType: 'market_average',
      label: formatSalaryLabel(avgMin, avgMax, titleMatches[0].currency),
    };
  }

  return {
    found: false,
    label: 'Data Unavailable',
  };
}

function formatResult(entry: SalaryEntry, matchType: 'exact' | 'market_average'): SalaryResult {
  return {
    found: true,
    salaryMin: entry.salaryMin,
    salaryMax: entry.salaryMax,
    currency: entry.currency,
    matchType,
    label: formatSalaryLabel(entry.salaryMin, entry.salaryMax, entry.currency),
  };
}

function formatSalaryLabel(min: number, max: number, currency: string): string {
  const fmt = (n: number) => {
    if (currency === 'USD' || currency === '$') {
      if (n >= 1000) return `$${Math.round(n / 1000)}k`;
      return `$${n}`;
    }
    if (currency === 'INR' || currency === '₹') {
      if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
      return `₹${Math.round(n / 1000)}k`;
    }
    return `${currency}${Math.round(n / 1000)}k`;
  };

  if (min === max) return fmt(min);
  return `${fmt(min)} - ${fmt(max)}`;
}
