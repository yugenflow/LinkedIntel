/**
 * Salary lookup — now handled server-side via SALARY_LOOKUP message.
 *
 * This file is kept for the formatSalaryLabel utility, which may be
 * used by future in-page badge rendering.
 */

export function formatSalaryLabel(min: number, max: number, currency: string): string {
  const fmt = (n: number) => {
    if (currency === 'INR' || currency === '₹') {
      if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
      return `₹${Math.round(n / 1000)}k`;
    }
    if (currency === 'USD' || currency === '$') {
      if (n >= 1000) return `$${Math.round(n / 1000)}k`;
      return `$${n}`;
    }
    if (currency === 'GBP' || currency === '£') {
      if (n >= 1000) return `£${Math.round(n / 1000)}k`;
      return `£${n}`;
    }
    return `${currency}${Math.round(n / 1000)}k`;
  };

  if (min === max) return fmt(min);
  return `${fmt(min)} - ${fmt(max)}`;
}
