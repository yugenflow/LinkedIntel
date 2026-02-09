/**
 * Build salary database from CSV source data + title aliases.
 *
 * Usage:  node scripts/build-salary-db.cjs
 * Output: middleware/data/salary-db.json
 *         src/data/salary-fallback.json
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data-sources');
const OUTPUT = path.join(__dirname, '..', 'middleware', 'data', 'salary-db.json');
const FALLBACK_OUTPUT = path.join(__dirname, '..', 'src', 'data', 'salary-fallback.json');

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

// ── Find all CSV files ──
const csvFiles = fs.readdirSync(DATA_DIR)
  .filter((f) => f.endsWith('-salaries.csv'))
  .sort();

if (csvFiles.length === 0) {
  console.error('No *-salaries.csv files found in', DATA_DIR);
  process.exit(1);
}

console.log(`Found ${csvFiles.length} CSV source files:`);
csvFiles.forEach((f) => console.log(`  - ${f}`));
console.log('');

// ── Build DB from all CSVs ──
let allRows = [];

for (const csvFile of csvFiles) {
  const filepath = path.join(DATA_DIR, csvFile);
  const rows = parseCSV(filepath);
  console.log(`  ${csvFile}: ${rows.length} entries`);
  allRows = allRows.concat(rows);
}

const db = allRows.map((row) => ({
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

// ── Validate entries ──
let validationErrors = 0;
const validCurrencies = new Set(['INR', 'USD', 'GBP', 'EUR', 'CAD', 'SGD', 'AED', 'AUD']);

db.forEach((entry, i) => {
  if (entry.salaryMin <= 0 || entry.salaryMax <= 0 || entry.salaryMedian <= 0) {
    console.warn(`  WARN row ${i + 1}: salary values must be > 0 (${entry.title}, ${entry.company})`);
    validationErrors++;
  }
  if (entry.salaryMin > entry.salaryMedian) {
    console.warn(`  WARN row ${i + 1}: salaryMin > salaryMedian (${entry.title}, ${entry.company})`);
    validationErrors++;
  }
  if (entry.salaryMedian > entry.salaryMax) {
    console.warn(`  WARN row ${i + 1}: salaryMedian > salaryMax (${entry.title}, ${entry.company})`);
    validationErrors++;
  }
  if (!validCurrencies.has(entry.currency)) {
    console.warn(`  WARN row ${i + 1}: invalid currency "${entry.currency}" (${entry.title}, ${entry.company})`);
    validationErrors++;
  }
});

// ── Check for duplicates ──
const seen = new Set();
let duplicates = 0;
db.forEach((entry) => {
  const key = `${entry.titleNormalized}|${entry.company.toLowerCase()}|${entry.city}|${entry.experienceLevel}`;
  if (seen.has(key)) {
    duplicates++;
  }
  seen.add(key);
});

// ── Write main output ──
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(db, null, 2), 'utf8');

// ── Generate fallback JSON ──
// Pick ~100-150 representative entries: one per title+country, preferring market averages
const fallbackMap = new Map();
db.forEach((entry) => {
  const key = `${entry.titleNormalized}|${entry.country}`;
  const existing = fallbackMap.get(key);
  // Prefer market averages (empty company) over company-specific
  if (!existing || (!entry.company && existing.company)) {
    fallbackMap.set(key, entry);
  }
});

const fallback = Array.from(fallbackMap.values());

fs.mkdirSync(path.dirname(FALLBACK_OUTPUT), { recursive: true });
fs.writeFileSync(FALLBACK_OUTPUT, JSON.stringify(fallback, null, 2), 'utf8');

// ── Print stats ──
console.log('');
console.log('=== Build Stats ===');
console.log(`Total entries: ${db.length}`);
console.log(`Validation errors: ${validationErrors}`);
console.log(`Duplicate keys: ${duplicates}`);
console.log('');

// Entries per country
const byCountry = {};
db.forEach((e) => {
  byCountry[e.country] = (byCountry[e.country] || 0) + 1;
});
console.log('Entries per country:');
Object.entries(byCountry)
  .sort((a, b) => b[1] - a[1])
  .forEach(([country, count]) => {
    console.log(`  ${country}: ${count}`);
  });

// Entries per source type
const bySource = {};
db.forEach((e) => {
  bySource[e.source] = (bySource[e.source] || 0) + 1;
});
console.log('');
console.log('Entries per source:');
Object.entries(bySource)
  .sort((a, b) => b[1] - a[1])
  .forEach(([source, count]) => {
    console.log(`  ${source}: ${count}`);
  });

// Unique titles
const uniqueTitles = new Set(db.map((e) => e.titleNormalized));
console.log('');
console.log(`Unique normalized titles: ${uniqueTitles.size}`);

// Unique companies
const uniqueCompanies = new Set(db.filter((e) => e.company).map((e) => e.company));
console.log(`Unique companies: ${uniqueCompanies.size}`);

console.log('');
console.log(`Fallback JSON: ${fallback.length} entries → ${FALLBACK_OUTPUT}`);
console.log(`Main DB: ${db.length} entries → ${OUTPUT}`);
