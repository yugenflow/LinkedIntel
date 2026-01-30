import { useState } from 'react';
import type { ProfileData, IntentType, ConnectMessage } from '../../lib/types';

interface Props {
  profile: ProfileData;
}

const INTENTS: { value: IntentType; label: string }[] = [
  { value: 'connect', label: 'Networking' },
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
    <div className="p-4 space-y-4">
      {/* Profile info */}
      <div className="bg-white rounded-lg border border-border p-4 space-y-1">
        <h2 className="text-sm font-bold text-text-primary">{profile.name}</h2>
        {profile.headline && <p className="text-xs text-text-secondary">{profile.headline}</p>}
        {profile.currentCompany && (
          <p className="text-xs text-text-secondary">{profile.currentCompany}</p>
        )}
      </div>

      {/* Intent selector */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary px-1">
          Message Intent
        </h3>
        <div className="flex gap-2">
          {INTENTS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setIntent(opt.value)}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                intent === opt.value
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-text-secondary border-border hover:border-primary'
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
          className="w-full py-2.5 px-4 bg-intel-teal text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
        >
          Generate Message
        </button>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-text-secondary">
          <span className="inline-block w-4 h-4 border-2 border-intel-teal border-t-transparent rounded-full animate-spin" />
          Drafting message...
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-danger text-sm p-3 rounded-lg">{error}</div>
      )}

      {/* Generated message */}
      {result && (
        <div className="space-y-3">
          <textarea
            value={editedMessage}
            onChange={(e) => setEditedMessage(e.target.value)}
            rows={6}
            className="w-full p-3 text-sm text-text-primary bg-white border border-border rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-intel-teal/30 focus:border-intel-teal"
          />

          {result.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.hashtags.map((tag) => (
                <span key={tag} className="text-xs text-intel-teal bg-teal-50 px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 py-2 px-4 bg-intel-teal text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              {copied ? 'Copied!' : 'Copy Message'}
            </button>
            <button
              onClick={handleGenerate}
              className="py-2 px-4 text-sm font-semibold text-text-secondary border border-border rounded-lg hover:border-intel-teal transition-colors"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
