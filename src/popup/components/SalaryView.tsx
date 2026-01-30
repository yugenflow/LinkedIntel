import type { SalaryCardData } from '../../lib/types';

interface Props {
  cards: SalaryCardData[];
}

export default function SalaryView({ cards }: Props) {
  if (cards.length === 0) {
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

  return (
    <div className="space-y-1.5 px-1">
      {cards.map((card, i) => (
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
          <span
            className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-md ${
              card.salary.found
                ? card.salary.matchType === 'exact'
                  ? 'bg-success-light text-success'
                  : 'bg-accent-subtle text-accent'
                : 'bg-surface-sunken text-text-tertiary'
            }`}
          >
            {card.salary.label}
          </span>
        </div>
      ))}
    </div>
  );
}
