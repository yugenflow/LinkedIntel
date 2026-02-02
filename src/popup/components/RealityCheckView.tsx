import { useState } from 'react';
import type { JobDescriptionData, MatchResult } from '../../lib/types';
import CategoryBreakdown from './CategoryBreakdown';
import Recommendations from './Recommendations';

interface Props {
  jd: JobDescriptionData;
}

export default function RealityCheckView({ jd }: Props) {
  const [result, setResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);

    try {
      const data = await chrome.storage.local.get('resume');
      const resume = data.resume as { text?: string } | null;
      if (!resume?.text) {
        setError('Upload your resume first.');
        setLoading(false);
        return;
      }

      const response = await chrome.runtime.sendMessage({
        type: 'MATCH_RESUME_JD',
        payload: { resumeText: resume.text, jdText: jd.description },
      });

      if (response.success && response.data) {
        setResult(response.data);
      } else {
        setError(response.error || 'Analysis failed.');
      }
    } catch {
      setError('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const gaugeColor = result
    ? result.status === 'strong'
      ? 'text-success'
      : result.status === 'moderate'
        ? 'text-warning'
        : 'text-danger'
    : 'text-text-tertiary';

  const gaugeBg = result
    ? result.status === 'strong'
      ? 'bg-success-light'
      : result.status === 'moderate'
        ? 'bg-warning-light'
        : 'bg-danger-light'
    : 'bg-surface-sunken';

  return (
    <div className="space-y-3 px-1">
      {/* Job card */}
      <div className="rounded-lg border border-border bg-surface p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <p className="text-[13px] font-medium text-text-primary">{jd.title}</p>
        <p className="text-[11px] text-text-tertiary mt-0.5">{jd.company}</p>
      </div>

      {/* Analyze button */}
      {!result && !loading && (
        <button
          onClick={handleAnalyze}
          className="w-full py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent/90 active:scale-[0.98] transition-all duration-150 shadow-[0_1px_3px_rgba(13,148,136,0.3)]"
        >
          Analyze match
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-5">
          <span className="inline-block w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-[12px] text-text-secondary">Analyzing...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-3 py-2 rounded-lg bg-danger-light text-danger text-[12px]">{error}</div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-2.5">
          {/* Score */}
          <div className={`flex items-center gap-4 rounded-lg p-4 ${gaugeBg}`}>
            <span className={`text-3xl font-bold tracking-tight ${gaugeColor}`}>
              {result.matchPercent}%
            </span>
            <div className="flex-1">
              <p className={`text-[12px] font-semibold capitalize ${gaugeColor}`}>
                {result.status} match
              </p>
              <p className="text-[11px] text-text-secondary mt-0.5 leading-snug">
                {result.summary}
              </p>
            </div>
          </div>

          {/* Skills */}
          {result.matchedSkills.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-success px-0.5">
                Matched ({result.matchedSkills.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {result.matchedSkills.map((skill) => (
                  <span key={skill} className="text-[11px] bg-success-light text-success px-2 py-0.5 rounded-md">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.missingSkills.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-danger px-0.5">
                Missing ({result.missingSkills.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {result.missingSkills.map((skill) => (
                  <span key={skill} className="text-[11px] bg-danger-light text-danger px-2 py-0.5 rounded-md">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.categories && result.categories.length > 0 && (
            <CategoryBreakdown categories={result.categories} />
          )}

          {result.recommendations && result.recommendations.length > 0 && (
            <Recommendations recommendations={result.recommendations} />
          )}

          <button
            onClick={() => setResult(null)}
            className="w-full py-1.5 text-[11px] text-text-tertiary hover:text-text-secondary transition-colors"
          >
            Re-analyze
          </button>
        </div>
      )}
    </div>
  );
}
