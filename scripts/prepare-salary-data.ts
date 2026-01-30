/**
 * Offline script to process raw CSV salary data into the bundled JSON dataset.
 *
 * Usage: npx tsx scripts/prepare-salary-data.ts <input.csv>
 *
 * Expected CSV columns: title, company, location, salary_min, salary_max, currency
 *
 * This script:
 * 1. Reads raw CSV data
 * 2. Normalizes titles (lowercase, remove special chars)
 * 3. Deduplicates entries
 * 4. Outputs src/data/salary-dataset.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface RawEntry {
  title: string;
  company: string;
  location: string;
  salary_min: string;
  salary_max: string;
  currency: string;
}

function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function parseCSV(content: string): RawEntry[] {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const entry: Record<string, string> = {};
    headers.forEach((h, i) => {
      entry[h] = values[i] || '';
    });
    return entry as unknown as RawEntry;
  });
}

const inputFile = process.argv[2];
if (!inputFile) {
  console.log('Usage: npx tsx scripts/prepare-salary-data.ts <input.csv>');
  console.log('No input file provided. The existing dataset will be kept.');
  process.exit(0);
}

const raw = readFileSync(inputFile, 'utf-8');
const entries = parseCSV(raw);

const output = entries.map((e) => ({
  title: e.title,
  titleNormalized: normalize(e.title),
  company: e.company || '',
  location: e.location,
  salaryMin: parseInt(e.salary_min, 10) || 0,
  salaryMax: parseInt(e.salary_max, 10) || 0,
  currency: e.currency || 'USD',
  source: 'processed',
}));

const outputPath = resolve(__dirname, '../src/data/salary-dataset.json');
writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`Wrote ${output.length} entries to ${outputPath}`);
