import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProfileData, IntentType, ConnectMessage } from '../../lib/types';

interface Props {
  profile: ProfileData;
}

const INTENTS: { value: IntentType; label: string }[] = [
  { value: 'connect', label: 'Network' },
  { value: 'referral', label: 'Referral' },
  { value: 'business', label: 'Business' },
];

function isRateLimitError(msg: string): boolean {
  return /rate.?limit|429|quota|too many/i.test(msg);
}

export default function SmartConnectView({ profile }: Props) {
  const [intent, setIntent] = useState<IntentType>('connect');
  const [result, setResult] = useState<ConnectMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editedMessage, setEditedMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startCooldown = useCallback((seconds: number) => {
    setCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  async function handleGenerate() {
    if (cooldown > 0) return;
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
        const errMsg = response.error || 'Failed to generate message.';
        setError(errMsg);
        if (isRateLimitError(errMsg)) {
          startCooldown(30);
        }
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
          disabled={cooldown > 0}
          className={`w-full py-2.5 text-[13px] font-medium rounded-lg transition-all duration-150 ${
            cooldown > 0
              ? 'bg-zinc-100 text-text-tertiary cursor-not-allowed'
              : 'bg-accent text-white hover:bg-accent/90 active:scale-[0.98] shadow-[0_1px_3px_rgba(13,148,136,0.3)]'
          }`}
        >
          {cooldown > 0 ? `Retry in ${cooldown}s` : 'Generate message'}
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
        <div className="px-3 py-2 rounded-lg bg-danger-light text-[12px] space-y-1">
          <p className="text-danger">
            {isRateLimitError(error)
              ? 'AI temporarily unavailable due to rate limits.'
              : error}
          </p>
          {cooldown > 0 && (
            <p className="text-danger/60 text-[11px]">
              You can retry in {cooldown} seconds.
            </p>
          )}
        </div>
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
              disabled={cooldown > 0}
              className={`py-2 px-4 text-[12px] font-medium border rounded-lg transition-all ${
                cooldown > 0
                  ? 'text-text-tertiary border-border cursor-not-allowed'
                  : 'text-text-secondary border-border hover:border-accent/40 hover:text-accent'
              }`}
            >
              {cooldown > 0 ? `${cooldown}s` : 'Retry'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
