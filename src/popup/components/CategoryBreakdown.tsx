import { useState } from 'react';
import type { CategoryBreakdown as CategoryBreakdownType } from '../../lib/types';

interface Props {
  categories: CategoryBreakdownType[];
}

export default function CategoryBreakdown({ categories }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(index: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function barColor(status: string) {
    if (status === 'strong') return 'bg-success';
    if (status === 'moderate') return 'bg-warning';
    return 'bg-danger';
  }

  function statusColor(status: string) {
    if (status === 'strong') return 'text-success';
    if (status === 'moderate') return 'text-warning';
    return 'text-danger';
  }

  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-text-secondary px-0.5 mb-1">Category Breakdown</p>
      {categories.map((cat, i) => {
        const isOpen = expanded.has(i);
        return (
          <div
            key={cat.name}
            className="rounded-lg border border-border bg-surface overflow-hidden"
          >
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-sunken/50 transition-colors"
            >
              <svg
                className={`w-3 h-3 text-text-tertiary shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M6 3l5 5-5 5V3z" />
              </svg>
              <span className="flex-1 text-[12px] text-text-primary truncate">{cat.name}</span>
              <span className={`text-[12px] font-semibold tabular-nums ${statusColor(cat.status)}`}>
                {cat.score}%
              </span>
            </button>

            {/* Progress bar */}
            <div className="px-3 pb-2">
              <div className="h-1.5 rounded-full bg-surface-sunken overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${barColor(cat.status)}`}
                  style={{ width: `${cat.score}%` }}
                />
              </div>
            </div>

            {/* Expanded details */}
            {isOpen && (cat.matched.length > 0 || cat.missing.length > 0) && (
              <div className="px-3 pb-2.5 pt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                {cat.matched.map((item) => (
                  <span key={item} className="text-[10px] text-success">
                    &#10003; {item}
                  </span>
                ))}
                {cat.missing.map((item) => (
                  <span key={item} className="text-[10px] text-danger">
                    &#10007; {item}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
