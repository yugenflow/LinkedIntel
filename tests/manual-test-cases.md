# Manual Test Cases — Salary DB Expansion (1.3)

## Prerequisites
1. `npm run build` — load `dist/` as unpacked extension in `chrome://extensions`
2. Start middleware: `cd middleware && GEMINI_API_KEY=<key> node dev-server.js`
3. Verify dev server logs show expanded DB loaded (2061 entries)

---

## Test Cases

### 1. India salary lookup
- [ ] Open LinkedIn job search, filter to India (Bangalore, Mumbai, etc.)
- [ ] Click extension icon — verify salary badges appear for common roles (SWE, PM, Data Scientist)
- [ ] Check IT services companies (TCS, Infosys, Wipro) show realistic INR ranges
- [ ] Check startups (Razorpay, Meesho, Groww) show higher ranges than IT services
- [ ] Verify format: salaries display in lakhs (e.g., "12.5L")

### 2. US salary lookup
- [ ] Search US-based jobs (Google, Meta, Amazon in San Francisco / NYC / Seattle)
- [ ] Click extension icon — verify USD salary badges appear
- [ ] Check FAANG roles show top-tier comp (SWE entry ~$130k+, Senior ~$200k+)
- [ ] Check non-tech companies (Boeing, Goldman Sachs) show appropriate ranges
- [ ] Verify format: salaries display as k (e.g., "$150k")

### 3. UK salary lookup
- [ ] Search UK-based jobs (London, Manchester, Edinburgh)
- [ ] Verify GBP salary badges appear
- [ ] Check London roles pay 15-25% more than other UK cities
- [ ] Verify format: salaries display as k (e.g., "65k")

### 4. EU salary lookup
- [ ] Search Germany-based jobs (Berlin, Munich)
- [ ] Verify EUR salary badges appear
- [ ] Search Dublin-based jobs — verify they resolve correctly
- [ ] Verify format: salaries display as k (e.g., "75k")

### 5. Canada salary lookup
- [ ] Search Canadian jobs (Toronto, Vancouver)
- [ ] Verify CAD salary badges appear (e.g., "CA$120k")
- [ ] Check Shopify, RBC show expected ranges

### 6. APAC salary lookup
- [ ] Search Singapore jobs — verify SGD badges (e.g., "S$95k")
- [ ] Search Australian jobs (Sydney, Melbourne) — verify AUD badges (e.g., "A$130k")

### 7. UAE salary lookup
- [ ] Search Dubai jobs — verify AED badges
- [ ] Check Careem, Amazon UAE show expected ranges

### 8. Format correctness
- [ ] India shows lakhs (e.g., "12.5L" not "1250k")
- [ ] US shows k with $ (e.g., "$150k")
- [ ] UK shows k with pound sign (e.g., "65k")
- [ ] EU shows k with euro sign (e.g., "75k")

### 9. Job detail page
- [ ] Click into a US job detail — verify "Similar Role" / "Market Avg" badge appears
- [ ] Click into an India job detail — verify salary context shows correctly
- [ ] Verify new roles (AI Engineer, SRE, Investment Banker) resolve via title aliases

### 10. Fuzzy matching
- [ ] Search a job with unusual title variant (e.g., "SDE II" should match Senior Software Engineer)
- [ ] Search "ML Engineer" — should match Machine Learning Engineer data
- [ ] Search "Full Stack Developer" — should match Full Stack Engineer data

### 11. AI fallback
- [ ] For a very niche role with no DB match (e.g., "Blockchain Compliance Officer"), verify AI estimate button still appears
- [ ] Verify the AI fallback doesn't fire for roles that DO have DB matches

### 12. Cache behavior
- [ ] Open popup for a job, note salary result
- [ ] Close and reopen popup for same job — verify result loads instantly from cache (no server request in network tab)

### 13. Collection vs detail consistency
- [ ] Note salary shown for a job on the search results page
- [ ] Click into that job's detail page
- [ ] Verify salary range shown is consistent between the two views

---

## Automated checks (already verified by build)
- [x] Total entries >= 2000 (actual: 2061)
- [x] IN >= 900 (938), US >= 500 (606), GB >= 100 (140), DE >= 50 (78), CA >= 50 (86), SG >= 30 (55), AU >= 30 (53), AE >= 30 (56)
- [x] 0 validation errors (salaryMin <= salaryMedian <= salaryMax, valid currencies)
- [x] Fallback JSON generated (212 entries)
- [x] `npm run build` passes cleanly
- [x] 97 canonical titles, 210 unique companies
