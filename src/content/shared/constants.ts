// Regex to detect salary-like text across multiple currencies
// Matches: $132K/yr, $132,000/yr, ₹12,00,000/yr, £65K - £85K, AED 25,000, etc.
export const SALARY_PATTERN = /(?:\$|₹|£|€|CA\$|A\$|S\$|AED|SGD|CHF|SEK|kr)\s*[\d,]+(?:\.\d+)?[kK]?\s*(?:\/\w+)?\s*[-–—]\s*(?:\$|₹|£|€|CA\$|A\$|S\$|AED|SGD|CHF|SEK|kr)\s*[\d,]+(?:\.\d+)?[kK]?\s*(?:\/\w+)?/;
