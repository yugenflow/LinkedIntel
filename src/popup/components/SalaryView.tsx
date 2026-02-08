import { useState } from 'react';
import type { SalaryCardData } from '../../lib/types';

interface Props {
  cards: SalaryCardData[];
  salaryLoading?: boolean;
  onRequestAiEstimate?: (cardIndex: number) => void;
  estimatingIndices?: Set<number>;
}

function matchTypeBadge(card: SalaryCardData) {
  const { salary } = card;
  if (!salary.found) {
    if (salary.label === 'Looking up...') {
      return { bg: 'bg-surface-sunken', text: 'text-text-tertiary', tag: null };
    }
    return { bg: 'bg-surface-sunken', text: 'text-text-tertiary', tag: null };
  }

  if (salary.isAiEstimate) {
    return { bg: 'bg-amber-50', text: 'text-amber-600', tag: 'AI Estimate' };
  }

  switch (salary.matchType) {
    case 'exact':
      return { bg: 'bg-success-light', text: 'text-success', tag: 'Company Match' };
    case 'company_average':
      return { bg: 'bg-success-light', text: 'text-success', tag: 'Company Avg' };
    case 'market_average':
      return { bg: 'bg-accent-subtle', text: 'text-accent', tag: 'Market Avg' };
    case 'national_average':
      return { bg: 'bg-accent-subtle', text: 'text-accent', tag: 'National Avg' };
    case 'fuzzy_average':
      return { bg: 'bg-accent-subtle', text: 'text-accent', tag: 'Similar Role' };
    default:
      return { bg: 'bg-accent-subtle', text: 'text-accent', tag: null };
  }
}

function InfoPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="rounded-lg border border-border bg-surface-sunken p-3 mb-2 text-[11px] leading-relaxed text-text-secondary">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-text-primary text-[12px]">How salary data works</span>
        <button onClick={onClose} className="text-text-tertiary hover:text-text-primary p-0.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <span className="shrink-0 font-semibold text-success w-[72px]">Company Match</span>
          <span>Salary data for this exact role at this company and location.</span>
        </div>
        <div className="flex gap-2">
          <span className="shrink-0 font-semibold text-success w-[72px]">Company Avg</span>
          <span>Average salary for this role at this company across locations in the same country.</span>
        </div>
        <div className="flex gap-2">
          <span className="shrink-0 font-semibold text-accent w-[72px]">Market Avg</span>
          <span>Average salary for this role in the same city, across multiple companies.</span>
        </div>
        <div className="flex gap-2">
          <span className="shrink-0 font-semibold text-accent w-[72px]">National Avg</span>
          <span>Average salary for this role across the country when city-level data isn't available.</span>
        </div>
        <div className="flex gap-2">
          <span className="shrink-0 font-semibold text-accent w-[72px]">Similar Role</span>
          <span>Matched to a similar job title using fuzzy matching when an exact title isn't in our database.</span>
        </div>
        <div className="flex gap-2">
          <span className="shrink-0 font-semibold text-amber-600 w-[72px]">AI Estimate</span>
          <span>No database match found. Salary estimated by AI based on role, company, and location.</span>
        </div>
      </div>
    </div>
  );
}

export default function SalaryView({ cards, salaryLoading, onRequestAiEstimate, estimatingIndices }: Props) {
  const [showInfo, setShowInfo] = useState(false);

  if (cards.length === 0 && !salaryLoading) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-6">
        <svg className="w-8 h-8 text-text-tertiary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
        </svg>
        <p className="text-[12px] text-text-tertiary text-center">
          Scroll through job listings to load salary data
        </p>
      </div>
    );
  }

  if (cards.length === 0 && salaryLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6">
        <span className="inline-block w-3.5 h-3.5 border-[1.5px] border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-[12px] text-text-tertiary">Looking up salaries...</span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 px-1">
      <div className="flex justify-end mb-0.5">
        <button
          onClick={() => setShowInfo(!showInfo)}
          className={`flex items-center justify-center w-5 h-5 rounded-full border transition-colors ${
            showInfo
              ? 'border-accent bg-accent-subtle text-accent'
              : 'border-border text-text-tertiary hover:text-accent hover:border-accent'
          }`}
          title="How salary data works"
        >
          <span className="text-[10px] font-bold leading-none">i</span>
        </button>
      </div>
      {showInfo && <InfoPanel onClose={() => setShowInfo(false)} />}
      {cards.map((card, i) => {
        const badge = matchTypeBadge(card);
        const isLoading = card.salary.label === 'Looking up...';
        const isUnavailable = !card.salary.found && card.salary.label === 'Data Unavailable';
        const isEstimating = estimatingIndices?.has(i) ?? false;
        const estimateFailed = card.salary.label === 'Estimate Failed';
        const hasPostedSalary = !!card.postedSalary;

        return (
          <div
            key={`${card.title}-${card.company}-${i}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:shadow-[0_2px_4px_rgba(0,0,0,0.06)] transition-shadow duration-200"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-text-primary truncate">{card.title}</p>
              <p className="text-[11px] text-text-tertiary truncate">
                {card.company}
                {card.location && <span> &middot; {card.location}</span>}
              </p>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-0.5">
              {/* Posted salary takes priority over everything */}
              {hasPostedSalary ? (
                <>
                  <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700">
                    {card.postedSalary}
                  </span>
                  <span className="text-[9px] text-emerald-700 opacity-70 px-1">Posted</span>
                </>
              ) : isLoading ? (
                <span className="flex items-center gap-1.5 text-[11px] text-text-tertiary px-2.5 py-1">
                  <span className="inline-block w-2.5 h-2.5 border border-text-tertiary/40 border-t-transparent rounded-full animate-spin" />
                </span>
              ) : isEstimating ? (
                <span className="flex items-center gap-1.5 text-[11px] text-amber-600 px-2.5 py-1">
                  <span className="inline-block w-2.5 h-2.5 border border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <span>Estimating...</span>
                </span>
              ) : (isUnavailable || estimateFailed) ? (
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-surface-sunken text-text-tertiary">
                    {card.salary.label}
                  </span>
                  {onRequestAiEstimate && (
                    <button
                      onClick={() => onRequestAiEstimate(i)}
                      className="flex items-center gap-1 text-[9px] font-medium text-amber-600 hover:text-amber-700 transition-colors px-1"
                    >
                      <svg className="w-2.5 h-2.5" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11 6.5 7.5 3 6l3.5-1.5L8 1zm4 7l.75 1.75L14.5 10.5l-1.75.75L12 13l-.75-1.75L9.5 10.5l1.75-.75L12 8zM4 9l.5 1.5L6 11l-1.5.5L4 13l-.5-1.5L2 11l1.5-.5L4 9z" />
                      </svg>
                      {estimateFailed ? 'Retry AI Estimate' : 'AI Estimate'}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <span className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md ${badge.bg} ${badge.text}`}>
                    {card.salary.isAiEstimate && (
                      <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11 6.5 7.5 3 6l3.5-1.5L8 1zm4 7l.75 1.75L14.5 10.5l-1.75.75L12 13l-.75-1.75L9.5 10.5l1.75-.75L12 8zM4 9l.5 1.5L6 11l-1.5.5L4 13l-.5-1.5L2 11l1.5-.5L4 9z" />
                      </svg>
                    )}
                    {card.salary.label}
                  </span>
                  {badge.tag && (
                    <span className={`text-[9px] ${badge.text} opacity-70 px-1`}>
                      {badge.tag}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
