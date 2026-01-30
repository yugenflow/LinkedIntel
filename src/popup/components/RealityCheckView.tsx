import { useState } from 'react';
import type { JobDescriptionData, MatchResult } from '../../lib/types';

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
        setError('Upload your resume in the extension popup first.');
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
    : 'text-text-secondary';

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg border border-border p-4 space-y-1">
        <h2 className="text-sm font-bold text-text-primary">{jd.title}</h2>
        <p className="text-xs text-text-secondary">{jd.company}</p>
      </div>

      {!result && !loading && (
        <button
          onClick={handleAnalyze}
          className="w-full py-2.5 px-4 bg-primary text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
        >
          Analyze Match
        </button>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-text-secondary">
          <span className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Analyzing resume match...
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-danger text-sm p-3 rounded-lg">{error}</div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Match gauge */}
          <div className="bg-white rounded-lg border border-border p-4 flex flex-col items-center gap-2">
            <span className={`text-4xl font-bold ${gaugeColor}`}>{result.matchPercent}%</span>
            <span className={`text-xs font-semibold uppercase tracking-wider ${gaugeColor}`}>
              {result.status} match
            </span>
            <p className="text-xs text-text-secondary text-center mt-1">{result.summary}</p>
          </div>

          {/* Matched skills */}
          {result.matchedSkills.length > 0 && (
            <div className="bg-white rounded-lg border border-border p-3 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-success">
                Matched Skills ({result.matchedSkills.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {result.matchedSkills.map((skill) => (
                  <span key={skill} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Missing skills */}
          {result.missingSkills.length > 0 && (
            <div className="bg-white rounded-lg border border-border p-3 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-danger">
                Missing Skills ({result.missingSkills.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {result.missingSkills.map((skill) => (
                  <span key={skill} className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setResult(null)}
            className="w-full py-2 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            Re-analyze
          </button>
        </div>
      )}
    </div>
  );
}
