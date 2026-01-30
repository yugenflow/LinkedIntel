# LinkedIntel

An intelligence layer for LinkedIn. Surfaces salary data, analyzes resume-to-job fit, and drafts personalized networking messages — all from the extension popup.

## Features

### Salary Intel
Browse LinkedIn job listings and see estimated salary ranges directly in the popup. Data comes from a bundled salary dataset with fuzzy matching by job title, company, and location.

### Reality Check
Open any LinkedIn job posting, click "Analyze match," and get an AI-powered breakdown of how your resume stacks up against the job description. Returns a match percentage, matched skills, missing skills, and a plain-language summary.

### Smart Connect
Visit any LinkedIn profile, pick your intent (networking, referral, or business), and generate a personalized connection message. Edit before copying.

## How It Works

```
LinkedIn Tab                     Extension Popup
┌──────────────────┐            ┌───────────────────────┐
│  Content Script   │           │  Header               │
│  (scrapes page)   │  message  │  Resume Upload        │
│                   ├──────────►│  Feature Toggles      │
│  Detects page     │           │  ──────────────────   │
│  type and sends   │           │  Context Section:     │
│  structured data  │           │   Salary cards   OR   │
│                   │           │   Match analysis  OR  │
│                   │           │   Message builder      │
└───────┬──────────┘            └──────────┬────────────┘
        │    Service Worker                │
        └───► Message Router ◄─────────────┘
                    │
                    ▼
              Gemini 2.5 Flash
              (match + connect)
```

1. Click the extension icon on any LinkedIn page
2. The popup detects the page type and shows the relevant feature
3. Salary data is looked up locally; match analysis and message generation call Gemini

## Setup

### Prerequisites
- Node.js 18+
- A Gemini API key ([get one here](https://aistudio.google.com/apikey))

### Install

```bash
git clone https://github.com/yugenflow/LinkedIntel.git
cd LinkedIntel
npm install
cd middleware && npm install && cd ..
```

### Build the Extension

```bash
npm run build
```

This outputs to `dist/`. Load it in Chrome:
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `dist/` folder

### Start the API Server

The extension needs a local API server running for AI features (match analysis and message generation):

```bash
cd middleware
GEMINI_API_KEY=your_key_here node dev-server.js
```

The server runs on `http://localhost:3001`.

### Development

Watch mode rebuilds on file changes:

```bash
npm run dev
```

After each rebuild, go to `chrome://extensions` and click the refresh icon on the extension card.

## Project Structure

```
src/
  popup/              React UI (App.tsx + components)
  background/         Service worker (message routing, API calls)
  content/
    reality-check/    Job detail page scraping
    salary-intel/     Job search page scraping + salary lookup
    smart-connect/    Profile page scraping
    shared/           Page detection, DOM utilities
  lib/
    types.ts          Shared TypeScript interfaces
    storage.ts        Chrome storage wrapper
    prompts.ts        Gemini prompt templates
    resume-parser/    PDF + DOCX text extraction
  data/               Bundled salary dataset
middleware/
  dev-server.js       Local Express API server
  api/                Vercel serverless functions (production)
public/
  manifest.json       Chrome extension manifest
  icons/              Extension icons
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Popup UI | React 19, Tailwind CSS 4 |
| Content Scripts | TypeScript (IIFE bundles) |
| Build | Vite with custom post-build plugin |
| Resume Parsing | pdfjs-dist, mammoth |
| AI | Gemini 2.5 Flash |
| API (dev) | Express |
| API (prod) | Vercel Serverless |
| Storage | Chrome Storage API |

## Architecture Notes

- **Single popup, no side panel.** The popup detects which LinkedIn page is active and renders the appropriate feature inline.
- **Content scripts are IIFE bundles.** Chrome content scripts can't use ES module imports, so Vite builds each one as a standalone IIFE with all dependencies inlined.
- **SPA-aware injection.** LinkedIn is a single-page app. When declarative content script injection misses a navigation, the service worker falls back to programmatic injection via `chrome.scripting.executeScript`.
- **Resilient scraping.** LinkedIn uses obfuscated CSS class names that change frequently. Scrapers use ordered arrays of selectors with stable attributes (`data-testid`, `href` patterns) as primary anchors.
- **Privacy-first AI.** PII (emails, phone numbers, SSNs) is stripped from all text before sending to Gemini. Resume data stays in Chrome local storage and is never persisted server-side.

## Deployment

The middleware can be deployed to Vercel:

```bash
cd middleware
npx vercel --prod
```

Update `API_BASE` in `src/background/service-worker.ts` to point to your Vercel deployment URL.

## License

MIT
