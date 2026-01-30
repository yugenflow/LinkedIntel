# LinkedIntel — Claude Code Project Reference

## What This Is
Chrome extension (Manifest V3) that adds an intelligence layer to LinkedIn: salary badges on job listings, resume-to-JD match analysis, and AI-generated networking messages. Everything runs through a single popup — no side panel.

## Tech Stack
- **Popup UI**: React 19 + Tailwind CSS 4 (Vite build)
- **Content Scripts**: Vanilla TypeScript, built as IIFE bundles
- **Service Worker**: Message router between popup, content scripts, and API
- **API Layer**: Gemini 2.5 Flash via local Express dev server / Vercel serverless
- **Resume Parsing**: pdfjs-dist (PDF) + mammoth (DOCX), runs in-browser

## Project Structure
```
src/
  background/service-worker.ts    — message router, API calls, script injection
  content/
    reality-check/                — job detail page scraping (jd-scraper.ts)
    salary-intel/                 — job search page scraping + salary lookup
    smart-connect/                — profile page scraping
    shared/                       — page-detector.ts, dom-observer.ts
  lib/
    types.ts                      — all shared TypeScript interfaces
    storage.ts                    — Chrome storage wrapper with defaults
    prompts.ts                    — Gemini prompt builders (match + connect)
    resume-parser/                — PDF and DOCX text extraction
  popup/                          — React app (App.tsx + 8 components)
  data/salary-dataset.json        — local salary reference data
middleware/
  dev-server.js                   — local Express server (port 3001)
  api/gemini-match.ts             — Vercel serverless handler
  api/gemini-connect.ts           — Vercel serverless handler
public/
  manifest.json                   — extension manifest
  icons/                          — LI monogram PNGs (16/32/48/128)
```

## Build Commands
```bash
# Install dependencies (both root and middleware)
npm install
cd middleware && npm install && cd ..

# Development build (watches for changes)
npm run dev

# Production build
npm run build

# Start local API server (requires GEMINI_API_KEY env var)
cd middleware && GEMINI_API_KEY=<key> node dev-server.js

# Generate extension icons
node scripts/generate-icons.cjs
```

## How It Works (Data Flow)
1. User clicks extension icon → popup opens
2. Popup sends `REQUEST_SCRAPE` → service worker → content script in active tab
3. Content script scrapes LinkedIn page → sends `PAGE_DATA` back through service worker
4. Popup receives `PAGE_DATA` → renders the matching view:
   - `/jobs/search/` → SalaryView (salary cards from local dataset)
   - `/jobs/view/` → RealityCheckView (resume-JD match via Gemini)
   - `/in/` → SmartConnectView (AI icebreaker via Gemini)

## Message Types (Chrome runtime messaging)
- `REQUEST_SCRAPE` — popup asks content script to scrape current page
- `PAGE_DATA` — content script sends scraped data to popup
- `MATCH_RESUME_JD` — popup requests Gemini match analysis
- `GENERATE_ICEBREAKER` — popup requests Gemini connect message
- `GET_STORAGE` / `SET_STORAGE` — storage operations through service worker

## Key Architecture Decisions
- **IIFE content scripts**: Vite builds each content script as a standalone IIFE bundle (no ES modules, no code splitting) because Chrome content scripts can't use `import`
- **Programmatic injection fallback**: Service worker uses `chrome.scripting.executeScript` when `sendMessage` fails (handles SPA navigation where declarative injection missed)
- **Multi-selector scraping**: LinkedIn uses obfuscated/hashed CSS classes. Scrapers try multiple selectors in order, including `data-testid` attributes as stable anchors
- **Local salary data**: Salary lookup uses a bundled JSON dataset with fuzzy title matching (60% word overlap threshold), no API call needed
- **24h match cache**: Resume-JD results cached in Chrome storage by content hash to avoid repeated API calls

## Content Script Selectors (Fragile)
LinkedIn frequently changes class names. If scraping breaks:
- **Job description**: Primary selector is `[data-testid="expandable-text-box"]`
- **Company**: Use `a[href*="/company/"]` pattern
- **Job title**: Falls back to structural search (first short text element outside description)
- All selector arrays are in `jd-scraper.ts`, `job-card-scraper.ts`, and `profile-scraper.ts`

## Styling Conventions
- Tailwind CSS 4 with `@theme` block in `popup.css` for design tokens
- Color palette: zinc tones + teal accent (#0D9488)
- Font: Geist (loaded via CDN @font-face)
- Popup dimensions: 420px wide, 480-600px tall
- Components use semantic color tokens: `text-primary`, `surface`, `border-subtle`, etc.

## API Configuration
- **Model**: Gemini 2.5 Flash (`gemini-2.5-flash`)
- **Match endpoint**: temp 0.3, max 4096 tokens, JSON response mode
- **Connect endpoint**: temp 0.7, max 2048 tokens, JSON response mode
- **PII stripping**: Emails, phone numbers, SSNs removed before sending to Gemini
- **Dev server**: localhost:3001 with CORS enabled
- **Production**: Vercel serverless functions

## Testing
No automated tests yet. Manual testing flow:
1. `npm run build` → load `dist/` as unpacked extension in `chrome://extensions`
2. Start middleware: `cd middleware && GEMINI_API_KEY=<key> node dev-server.js`
3. Navigate to LinkedIn job search → verify salary cards appear in popup
4. Navigate to job detail → verify "Analyze match" works (requires uploaded resume)
5. Navigate to profile → verify "Generate message" works
6. Test on non-LinkedIn page → verify hint text appears

## Common Issues
- **Content script not injecting**: LinkedIn is an SPA; navigating within LinkedIn doesn't trigger new content script injection. The service worker fallback handles this, but if it breaks, check `getContentScriptForUrl()` in service-worker.ts
- **API 500 errors**: Usually Gemini quota or model availability. Check middleware console logs. The dev server has retry logic (2 attempts)
- **Scraper returning nulls**: LinkedIn changed their DOM. Inspect the page, find new selectors, update the selector arrays in the relevant scraper file
- **Extension invalidated errors**: After reloading the extension, close and reopen LinkedIn tabs to clear stale content script contexts
