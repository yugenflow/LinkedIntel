import { useState } from 'react';
import type { ProfileData, IntentType, ConnectMessage } from '../../lib/types';

interface Props {
  profile: ProfileData;
}

const INTENTS: { value: IntentType; label: string }[] = [
  { value: 'connect', label: 'Network' },
  { value: 'referral', label: 'Referral' },
  { value: 'business', label: 'Business' },
];

export default function SmartConnectView({ profile }: Props) {
  const [intent, setIntent] = useState<IntentType>('connect');
  const [result, setResult] = useState<ConnectMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editedMessage, setEditedMessage] = useState('');

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await chrome.storage.local.get('resume');
      const resume = data.resume as { text?: string } | null;
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_ICEBREAKER',
        payload: {
          profile,
          intent,
          resumeContext: resume?.text,
        },
      });

      if (response.success && response.data) {
        setResult(response.data);
        setEditedMessage(response.data.message);
      } else {
        setError(response.error || 'Failed to generate message.');
      }
    } catch {
      setError('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(editedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3 px-1">
      {/* Profile card */}
      <div className="rounded-lg border border-border bg-surface p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <p className="text-[13px] font-medium text-text-primary">{profile.name}</p>
        {profile.headline && (
          <p className="text-[11px] text-text-tertiary mt-0.5 line-clamp-2">{profile.headline}</p>
        )}
        {profile.currentCompany && (
          <p className="text-[11px] text-text-secondary mt-0.5">{profile.currentCompany}</p>
        )}
      </div>

      {/* Intent selector */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-text-secondary px-0.5">Intent</p>
        <div className="flex gap-1.5">
          {INTENTS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setIntent(opt.value)}
              className={`flex-1 py-2 text-[12px] font-medium rounded-lg border transition-all duration-150 ${
                intent === opt.value
                  ? 'bg-accent text-white border-accent shadow-[0_1px_3px_rgba(13,148,136,0.3)]'
                  : 'bg-surface text-text-secondary border-border hover:border-accent/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      {!result && !loading && (
        <button
          onClick={handleGenerate}
          className="w-full py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent/90 active:scale-[0.98] transition-all duration-150 shadow-[0_1px_3px_rgba(13,148,136,0.3)]"
        >
          Generate message
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-5">
          <span className="inline-block w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-[12px] text-text-secondary">Drafting...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-3 py-2 rounded-lg bg-danger-light text-danger text-[12px]">{error}</div>
      )}

      {/* Generated message */}
      {result && (
        <div className="space-y-2.5">
          <textarea
            value={editedMessage}
            onChange={(e) => setEditedMessage(e.target.value)}
            rows={5}
            className="w-full p-3 text-[12px] text-text-primary bg-surface border border-border rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all placeholder:text-text-tertiary"
          />

          {result.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {result.hashtags.map((tag) => (
                <span key={tag} className="text-[10px] text-accent bg-accent-subtle px-2 py-0.5 rounded-md">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className={`flex-1 py-2 text-[12px] font-medium rounded-lg transition-all duration-150 ${
                copied
                  ? 'bg-success-light text-success'
                  : 'bg-accent text-white hover:bg-accent/90 shadow-[0_1px_3px_rgba(13,148,136,0.3)]'
              }`}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={handleGenerate}
              className="py-2 px-4 text-[12px] font-medium text-text-secondary border border-border rounded-lg hover:border-accent/40 hover:text-accent transition-all"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
