# LinkedIntel — Product Roadmap

## Design Principles
- **Data integrity first**: Any salary figure, market comparison, or recommendation shown to the user must be backed by real data (DB matches, verified sources). Do NOT rely on AI estimates for data-driven features like salary visualization or market positioning. AI is fine for generative tasks (message writing, resume recommendations, interview prep) but not for presenting numbers as facts.
- **Progressive disclosure**: Show simple insights by default, let users drill into detail on demand.
- **Zero-config by default**: Features should work out of the box. Advanced config (API keys, toggles) is optional.
- **Hybrid API model**: Ship with user-provided API key as default (zero infra cost, power users can manage their own usage). Add hosted "LinkedIntel Pro" backend later as the monetization path. Salary DB lookups (no AI) are always free and keyless.

---

## Phase 1: Solidify Current Features

### 1.1 Storage Quota Management ✅ DONE
- Match cache capped at 100 entries, salary cache at 500 entries
- LRU eviction on insert — oldest entries (by `cachedAt`) dropped when over cap
- Startup sweep on service worker init: purges entries older than 7 days
- All cache writes enforce limits before persisting to Chrome storage
- Future: surface storage usage in popup settings

### 1.2 API Resilience ✅ DONE
- **Exponential backoff**: 3 retries with 1s → 3s → 9s delays; 3s → 9s → 27s for rate-limit errors
- **Rate limit detection**: Middleware detects 429/quota errors from Gemini, returns HTTP 429 (not generic 500)
- **In-flight deduplication**: Service worker prevents duplicate API calls when users rapidly click or navigate — same request key returns same pending promise
- **Graceful error UI**: Popup shows "AI temporarily unavailable due to rate limits" with 30-second cooldown timer on action buttons ("Retry in Xs") instead of raw error codes
- **Tiered cache TTL**: AI salary estimates cached 7 days (market rates are stable), DB results cached 24 hours
- **Better error propagation**: API error bodies are parsed and forwarded to the UI instead of generic "API error: 500"

### 1.3 Expand Salary Database ✅ DONE
- Expanded from 679 India-only entries to **2061 entries across 12 countries**
- **7 regional CSVs**: India (938), US (606), UK (140), EU/Germany (78), Canada (86), APAC/SG+AU (108), UAE (56)
- **210 unique companies** covered (up from ~80) including FAANG, fintech, consulting, banking
- **Title aliases** expanded from 38 to 97 canonical titles with ~400 alias mappings
- **Build pipeline** updated: multi-CSV glob, validation, stats reporting, auto-generated fallback JSON (212 entries)
- **Location resolver** expanded: 13 countries, new cities (Waterloo, Brisbane, Perth, Adelaide, Stockholm), Canadian/Australian state mappings
- **Gate cleared**: 1.4 Salary Visualization can now proceed

### 1.4 Salary Intel Enhancements (requires 1.3 complete)
- **Salary range visualization**: Mini bar/range chart in popup showing where a salary falls within the range
- **"Below / At / Above Market" labels**: Compare listed salary (when LinkedIn shows one) against DB data and flag it
- **Salary context line**: "This role typically pays X% more/less than national average" for quick reference
- **Salary history/trends**: Show how a company's pay for a role compares to industry peers
- NOTE: Only show market comparison when backed by real DB data (`company_average` or `market_average` match types). Never show AI estimates as market positioning — this is a core design principle.

### 1.5 Reality Check Enhancements
- **Tailor My Resume**: Generate specific, copy-pasteable bullet points the user can add to their resume to close gaps for *this* job. Extends existing recommendations — make them actionable, not just advisory.
- **Multi-JD Comparison**: Save 3-5 match results, compare side-by-side with strength ranking. "You're strongest for Role A (82%) vs Role C (61%)." Helps users prioritize applications.
- **Analyzed Jobs List**: Simple history of jobs the user has analyzed with scores — lightweight application tracker. Not a full ATS, just a quick reference panel. Uses cached data, no API calls.

### 1.6 Smart Connect Enhancements
- **Tone selector**: Professional / Casual / Witty — small prompt tweak, big personalization gain. 3 buttons alongside the intent selector.
- **Message templates**: Save generated messages as reusable templates. "Use this style again" for future connections with similar profiles.

---

## Phase 2: New Features

### 2.1 Job Fit Radar
- On `/jobs/search/`, show a colored dot (green/yellow/red) on each job card indicating estimated resume match
- **Local keyword overlap only** — no API call for the dots (fast, free, works offline)
- Gemini called only when user clicks into a job for detailed analysis via Reality Check
- Killer differentiator: instant visual signal across all search results without any API cost
- Requires uploaded resume to activate

### 2.2 Company Intel Card
- New content script for `/company/` pages
- Show: average salary range from DB, number of open positions, growth signals
- Content script scrapes company page metadata, cross-references salary DB for that employer
- Only show salary data when real DB entries exist for that company (design principle: no AI estimates for data)

### 2.3 Interview Prep
- On job detail page, after match analysis, offer "Prep for this role" button
- Gemini generates likely interview questions based on JD + resume gaps identified in Reality Check
- Categories: technical, behavioral, domain-specific
- High value, low additional engineering effort (new prompt template + simple collapsible UI)

### 2.4 Network Map
- On profile pages, suggest *why* a connection is valuable based on the user's analyzed jobs
- "This person works at [Company] where you applied for [Role]"
- Cross-references Smart Connect profile data with Reality Check job history stored in cache
- Requires the Analyzed Jobs List (1.5) to be built first

### 2.5 Weekly Digest
- Browser notification: "You analyzed 8 jobs this week. Top match: [Role] at [Company] (87%). 3 below market salary."
- Uses cached data only — no API calls
- Light engagement hook to keep users returning to the extension
- Requires `chrome.notifications` permission addition

---

## Phase 3: Deployment & Monetization

### 3.1 User API Key Support (Hybrid Model)
- **Default mode**: User provides their own Gemini API key in popup settings
  - Requests go directly to Gemini from the service worker — no middleware needed
  - Free Gemini API key is sufficient for personal use (15 RPM / 1M TPD)
  - Zero infrastructure cost for us
  - Users get full control over their usage and rate limits
- **If no key set**: Show setup prompt with link to get a free Gemini key + instructions
- **Future Pro mode**: Users can opt into LinkedIntel's hosted API for higher limits, no key management
- Salary DB lookups (no AI) always work without any key — it's our data
- This approach unblocks Chrome Web Store submission immediately

### 3.2 Chrome Web Store Launch
- Package extension for store submission
- Write privacy policy (resume stays in local Chrome storage, PII stripped before any AI calls, no analytics/tracking)
- Store listing: screenshots of each feature, 30-second demo video
- Compliance: declare `activeTab`, `storage`, `scripting` permissions with justification

### 3.3 LinkedIntel Pro (Future Monetization)
- **Hosted API backend**: Higher rate limits, faster responses, premium Gemini model access
- **Premium salary DB**: Broader coverage, more companies, more frequent updates
- **Priority AI processing**: Dedicated API quota, no rate limit concerns
- **Pricing model**: Freemium — free tier with user's own key, Pro subscription ($X/month) for hosted experience
- **Revenue split**: Low marginal cost per user (Gemini API is cheap at scale), high perceived value

### 3.4 API Configuration Cleanup
- Replace hardcoded `API_BASE = 'http://localhost:3099/api'` with environment-aware config
- Dev: localhost, Production: Vercel serverless URL or user's direct Gemini key
- Build-time injection via Vite `define` or runtime detection

---

## Implementation Status

| Item | Status | Notes |
|------|--------|-------|
| 1.1 Storage Quota Management | ✅ Done | LRU eviction, startup sweep, size caps |
| 1.2 API Resilience | ✅ Done | Backoff, dedup, cooldown UI, tiered TTL |
| 1.3 Salary DB Expansion | ✅ Done | 2061 entries, 12 countries, 210 companies |
| 1.4 Salary Visualization | ⬜ Next | 1.3 complete, ready to build |
| 1.5 Reality Check Enhancements | ⬜ Planned | |
| 1.6 Smart Connect Enhancements | ⬜ Planned | |
| 2.1 Job Fit Radar | ⬜ Planned | High-impact feature |
| 2.2 Company Intel Card | ⬜ Planned | |
| 2.3 Interview Prep | ⬜ Planned | |
| 2.4 Network Map | ⬜ Planned | Needs 1.5 |
| 2.5 Weekly Digest | ⬜ Planned | |
| 3.1 User API Key (Hybrid) | ⬜ Planned | Unblocks store launch |
| 3.2 Chrome Web Store | ⬜ Planned | |
| 3.3 LinkedIntel Pro | ⬜ Future | |

---

*Last updated: 2026-02-08*
