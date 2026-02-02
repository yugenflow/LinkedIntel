import type { ResumeRecommendation } from '../../lib/types';

interface Props {
  recommendations: ResumeRecommendation[];
}

function priorityDot(priority: string) {
  if (priority === 'high') return 'bg-danger';
  if (priority === 'medium') return 'bg-warning';
  return 'bg-zinc-400';
}

function priorityLabel(priority: string) {
  return priority.toUpperCase();
}

export default function Recommendations({ recommendations }: Props) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-text-secondary px-0.5">Resume Recommendations</p>
      {recommendations.map((rec, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-surface p-3 space-y-1.5"
        >
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityDot(rec.priority)}`} />
            <span className="text-[10px] font-semibold tracking-wide text-text-tertiary">
              {priorityLabel(rec.priority)}
            </span>
            <span className="text-[10px] text-text-tertiary">&middot;</span>
            <span className="text-[10px] text-text-tertiary">{rec.area}</span>
          </div>
          <p className="text-[12px] text-text-primary leading-snug">{rec.suggestion}</p>
          <p className="text-[11px] text-text-secondary italic leading-snug">
            &ldquo;{rec.example}&rdquo;
          </p>
        </div>
      ))}
    </div>
  );
}
