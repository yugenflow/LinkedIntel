import type { SalaryCardData } from '../../lib/types';

interface Props {
  cards: SalaryCardData[];
}

export default function SalaryView({ cards }: Props) {
  if (cards.length === 0) {
    return (
      <div className="p-6 text-center text-text-secondary text-sm">
        No job cards found on this page. Scroll through the job listings to load results.
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-wider text-text-secondary px-1 pb-1">
        Salary Intel ({cards.length} jobs)
      </h2>
      {cards.map((card, i) => (
        <div
          key={`${card.title}-${card.company}-${i}`}
          className="bg-white rounded-lg border border-border p-3 space-y-1"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text-primary truncate">{card.title}</p>
              <p className="text-xs text-text-secondary truncate">{card.company}</p>
            </div>
            <span
              className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${
                card.salary.found
                  ? card.salary.matchType === 'exact'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-blue-50 text-blue-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {card.salary.label}
            </span>
          </div>
          {card.location && (
            <p className="text-xs text-text-secondary">{card.location}</p>
          )}
          {card.salary.found && card.salary.matchType === 'market_average' && (
            <p className="text-[10px] text-text-secondary italic">Market average</p>
          )}
        </div>
      ))}
    </div>
  );
}
