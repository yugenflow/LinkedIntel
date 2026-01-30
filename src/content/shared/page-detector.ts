export type LinkedInPage = 'job-detail' | 'job-search' | 'profile' | 'other';

export function detectPage(url?: string): LinkedInPage {
  const href = url || window.location.href;

  if (/linkedin\.com\/jobs\/view\//.test(href)) return 'job-detail';
  if (/linkedin\.com\/jobs\/(search|collections)/.test(href) || /linkedin\.com\/jobs\/?(\?|$)/.test(href)) return 'job-search';
  if (/linkedin\.com\/in\//.test(href)) return 'profile';

  return 'other';
}
