/**
 * Build salary database from CSV source data + title aliases.
 *
 * Usage:  node scripts/build-salary-db.js
 * Output: middleware/data/salary-db.json
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data-sources');
const OUTPUT = path.join(__dirname, '..', 'middleware', 'data', 'salary-db.json');

// ── Load title aliases ──
const aliases = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, 'title-aliases.json'), 'utf8')
);

// Build reverse map: alias → canonical title
const aliasMap = {};
for (const [canonical, alts] of Object.entries(aliases)) {
  aliasMap[canonical] = canonical;
  for (const alt of alts) {
    aliasMap[alt.toLowerCase()] = canonical;
  }
}

function normalizeTitle(raw) {
  const lower = raw.toLowerCase().trim();
  if (aliasMap[lower]) return aliasMap[lower];

  // Try substring match
  for (const [alias, canonical] of Object.entries(aliasMap)) {
    if (lower.includes(alias) || alias.includes(lower)) return canonical;
  }
  return lower;
}

// ── Parse CSV ──
function parseCSV(filepath) {
  const raw = fs.readFileSync(filepath, 'utf8');
  const lines = raw.split('\n').filter((l) => l.trim());
  const headers = lines[0].split(',').map((h) => h.trim());

  return lines.slice(1).map((line) => {
    // Simple CSV parse (no quoted commas in this dataset)
    const values = line.split(',').map((v) => v.trim());
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || '';
    });
    return row;
  });
}

// ── Build DB ──
const rows = parseCSV(path.join(DATA_DIR, 'india-salaries.csv'));

const db = rows.map((row) => ({
  title: row.title,
  titleNormalized: normalizeTitle(row.title),
  company: row.company || '',
  city: row.city ? row.city.toLowerCase() : '',
  state: row.state ? row.state.toLowerCase() : '',
  country: row.country || 'IN',
  experienceLevel: row.experienceLevel || 'mid',
  salaryMin: parseInt(row.salaryMin, 10) || 0,
  salaryMax: parseInt(row.salaryMax, 10) || 0,
  salaryMedian: parseInt(row.salaryMedian, 10) || 0,
  currency: row.currency || 'INR',
  source: row.source || 'public',
}));

// ── Write output ──
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(db, null, 2), 'utf8');

console.log(`Built salary DB: ${db.length} entries → ${OUTPUT}`);
