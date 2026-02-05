import { useState, useEffect, useCallback, useRef } from 'react';
import type { ParsedResume, PageDataPayload, SalaryResult, SalaryCardData } from '../lib/types';
import { getStorage, setStorage } from '../lib/storage';
import { parseResume } from '../lib/resume-parser';
import Header from './components/Header';
import ResumeUpload from './components/ResumeUpload';
import ResumeStatus from './components/ResumeStatus';
import FeatureToggles from './components/FeatureToggles';
import Footer from './components/Footer';
import SalaryView from './components/SalaryView';
import RealityCheckView from './components/RealityCheckView';
import SmartConnectView from './components/SmartConnectView';

export default function App() {
  const [resume, setResume] = useState<ParsedResume | null>(null);
  const [showSalary, setShowSalary] = useState(true);
  const [enableConnect, setEnableConnect] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pageData, setPageData] = useState<PageDataPayload | null>(null);
  const [scrapeLoading, setScrapeLoading] = useState(true);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [estimatingIndices, setEstimatingIndices] = useState<Set<number>>(new Set());
  const salaryCardsRef = useRef<SalaryCardData[]>([]);

  // Job detail salary state
  const [jdSalary, setJdSalary] = useState<SalaryResult | null>(null);
  const [jdSalaryLoading, setJdSalaryLoading] = useState(false);

  // Load persisted state
  useEffect(() => {
    getStorage(['resume', 'showSalaryBadges', 'enableSmartConnect']).then((data) => {
      setResume(data.resume);
      setShowSalary(data.showSalaryBadges);
      setEnableConnect(data.enableSmartConnect);
    });
  }, []);

  // Trigger a scrape request and set a timeout
  const requestScrape = useCallback(() => {
    setScrapeLoading(true);
    setPageData(null);
    setJdSalary(null);

    chrome.runtime.sendMessage({ type: 'REQUEST_SCRAPE' }).catch(() => {
      // No content script available
    });

    // Timeout: if no response in 3s, stop loading
    const timeout = setTimeout(() => {
      setScrapeLoading(false);
    }, 3000);

    return timeout;
  }, []);

  // Listen for PAGE_DATA, SALARY_LOOKUP_RESULT, AI_ESTIMATE_RESULT
  useEffect(() => {
    const listener = (message: { type: string; payload?: any }) => {
      if (message.type === 'PAGE_DATA' && message.payload) {
        const data = message.payload as PageDataPayload;
        setPageData(data);
        setScrapeLoading(false);

        if (data.page === 'job-search') {
          salaryCardsRef.current = data.salaryCards;
          const hasPlaceholders = data.salaryCards.some((c: SalaryCardData) => c.salary.label === 'Looking up...');
          if (hasPlaceholders) {
            setSalaryLoading(true);
          }
        }

        // Auto-lookup salary for job detail page
        if (data.page === 'job-detail' && data.jd) {
          setJdSalaryLoading(true);
          chrome.runtime.sendMessage({
            type: 'SALARY_LOOKUP',
            payload: {
              jobs: [{ title: data.jd.title, company: data.jd.company, location: '' }],
            },
          }).catch(() => {});
        }
      }

      // Handle salary lookup results
      if (message.type === 'SALARY_LOOKUP_RESULT' && message.payload?.results) {
        const results: SalaryResult[] = message.payload.results;

        // Check if this is a job-detail single lookup or job-search batch
        if (results.length === 1 && pageData?.page === 'job-detail') {
          setJdSalary(results[0]);
          setJdSalaryLoading(false);
        } else if (salaryCardsRef.current.length > 0) {
          const updatedCards = salaryCardsRef.current.map((card: SalaryCardData, i: number) => ({
            ...card,
            salary: results[i] || card.salary,
          }));
          salaryCardsRef.current = updatedCards;
          setPageData({ page: 'job-search', salaryCards: updatedCards });
          setSalaryLoading(false);
        }
      }

      // Handle single AI estimate result
      if (message.type === 'AI_ESTIMATE_RESULT' && message.payload) {
        const { result, cardIndex } = message.payload as { result: SalaryResult; cardIndex: number };
        const cards = [...salaryCardsRef.current];
        if (cards[cardIndex]) {
          cards[cardIndex] = { ...cards[cardIndex], salary: result };
          salaryCardsRef.current = cards;
          setPageData({ page: 'job-search', salaryCards: cards });
        }
        setEstimatingIndices((prev) => {
          const next = new Set(prev);
          next.delete(cardIndex);
          return next;
        });
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    const timeout = requestScrape();

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
      clearTimeout(timeout);
    };
  }, [requestScrape]);

  const handleRefresh = useCallback(() => {
    requestScrape();
  }, [requestScrape]);

  const handleRequestAiEstimate = useCallback((cardIndex: number) => {
    const card = salaryCardsRef.current[cardIndex];
    if (!card) return;

    setEstimatingIndices((prev) => new Set(prev).add(cardIndex));

    chrome.runtime.sendMessage({
      type: 'AI_ESTIMATE_SALARY',
      payload: {
        title: card.title,
        company: card.company,
        location: card.location,
        cardIndex,
      },
    }).catch(() => {
      setEstimatingIndices((prev) => {
        const next = new Set(prev);
        next.delete(cardIndex);
        return next;
      });
    });
  }, []);

  const handleRequestJdAiEstimate = useCallback(() => {
    if (!pageData || pageData.page !== 'job-detail') return;
    setJdSalaryLoading(true);
    chrome.runtime.sendMessage({
      type: 'AI_ESTIMATE_SALARY',
      payload: {
        title: pageData.jd.title,
        company: pageData.jd.company,
        location: '',
        cardIndex: -1,
      },
    }).catch(() => setJdSalaryLoading(false));
  }, [pageData]);

  // Also listen for AI estimate result for jd
  useEffect(() => {
    const listener = (message: { type: string; payload?: any }) => {
      if (message.type === 'AI_ESTIMATE_RESULT' && message.payload?.cardIndex === -1) {
        setJdSalary(message.payload.result);
        setJdSalaryLoading(false);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const parsed = await parseResume(file);
      setResume(parsed);
      await setStorage({ resume: parsed });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }, []);

  const handleToggleSalary = useCallback(async (value: boolean) => {
    setShowSalary(value);
    await setStorage({ showSalaryBadges: value });
  }, []);

  const handleToggleConnect = useCallback(async (value: boolean) => {
    setEnableConnect(value);
    await setStorage({ enableSmartConnect: value });
  }, []);

  const handleChangeResume = useCallback(() => {
    setResume(null);
    setError(null);
  }, []);

  function renderSalaryBadge() {
    if (!pageData || pageData.page !== 'job-detail') return null;

    if (jdSalaryLoading) {
      return (
        <div className="flex items-center gap-2 px-1 mb-3">
          <span className="inline-block w-2.5 h-2.5 border-[1.5px] border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-[11px] text-text-tertiary">Looking up salary...</span>
        </div>
      );
    }

    if (jdSalary && jdSalary.found) {
      const isAi = jdSalary.isAiEstimate;
      const bgClass = isAi ? 'bg-amber-50 border-amber-200' : 'bg-accent-subtle border-accent/20';
      const textClass = isAi ? 'text-amber-600' : 'text-accent';
      const tagText = isAi ? 'AI Estimate'
        : jdSalary.matchType === 'exact' || jdSalary.matchType === 'company_average' ? 'Company Data'
        : jdSalary.matchType === 'market_average' ? 'Market Avg'
        : jdSalary.matchType === 'national_average' ? 'National Avg'
        : 'Estimated Range';

      return (
        <div className={`flex items-center justify-between rounded-lg border ${bgClass} px-3 py-2 mb-3`}>
          <div className="flex items-center gap-2">
            <svg className={`w-3.5 h-3.5 ${textClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            <span className="text-[11px] text-text-secondary">Salary Range</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[12px] font-semibold ${textClass}`}>
              {isAi && (
                <svg className="w-3 h-3 inline mr-1" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11 6.5 7.5 3 6l3.5-1.5L8 1z" />
                </svg>
              )}
              {jdSalary.label}
            </span>
            <span className={`text-[9px] ${textClass} opacity-70`}>{tagText}</span>
          </div>
        </div>
      );
    }

    // No salary data — show AI estimate button
    return (
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface-sunken px-3 py-2 mb-3">
        <span className="text-[11px] text-text-tertiary">Salary data unavailable</span>
        <button
          onClick={handleRequestJdAiEstimate}
          className="flex items-center gap-1 text-[10px] font-medium text-amber-600 hover:text-amber-700 transition-colors"
        >
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11 6.5 7.5 3 6l3.5-1.5L8 1zm4 7l.75 1.75L14.5 10.5l-1.75.75L12 13l-.75-1.75L9.5 10.5l1.75-.75L12 8zM4 9l.5 1.5L6 11l-1.5.5L4 13l-.5-1.5L2 11l1.5-.5L4 9z" />
          </svg>
          AI Estimate
        </button>
      </div>
    );
  }

  function renderContextSection() {
    if (scrapeLoading) {
      return (
        <div className="flex items-center justify-center gap-2 py-8">
          <span className="inline-block w-3.5 h-3.5 border-[1.5px] border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-[12px] text-text-tertiary">Detecting page...</span>
        </div>
      );
    }

    if (!pageData || pageData.page === 'other') {
      return (
        <div className="flex flex-col items-center gap-3 py-8 px-4">
          <div className="w-10 h-10 rounded-xl bg-surface-sunken flex items-center justify-center">
            <svg className="w-5 h-5 text-text-tertiary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </div>
          <p className="text-[12px] text-text-tertiary text-center leading-relaxed max-w-[260px]">
            Open a LinkedIn job search, job posting, or profile to unlock contextual features.
          </p>
          <button
            onClick={handleRefresh}
            className="text-[11px] font-medium text-text-tertiary hover:text-accent transition-colors flex items-center gap-1 mt-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.106.932.75.75 0 0 1-1.317-.72 6 6 0 0 1 9.475-1.242l.842.84V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.475 1.242l-.842-.84v1.371a.75.75 0 0 1-1.5 0V9.591a.75.75 0 0 1 .75-.75h3.182a.75.75 0 0 1 0 1.5h-1.37l.84.841a4.5 4.5 0 0 0 7.106-.932.75.75 0 0 1 1.274.727Z" clipRule="evenodd" />
            </svg>
            Refresh
          </button>
        </div>
      );
    }

    const sectionLabel =
      pageData.page === 'job-search' ? 'Salary Intel' :
      pageData.page === 'job-detail' ? 'Reality Check' :
      'Smart Connect';

    return (
      <>
        <div className="flex items-center justify-between px-1 mb-2">
          <p className="text-[12px] font-semibold text-text-primary">{sectionLabel}</p>
          <button
            onClick={handleRefresh}
            title="Refresh page data"
            className="text-text-tertiary/40 hover:text-accent transition-all p-1 -mr-1 rounded-md hover:bg-accent-subtle"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.106.932.75.75 0 0 1-1.317-.72 6 6 0 0 1 9.475-1.242l.842.84V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.475 1.242l-.842-.84v1.371a.75.75 0 0 1-1.5 0V9.591a.75.75 0 0 1 .75-.75h3.182a.75.75 0 0 1 0 1.5h-1.37l.84.841a4.5 4.5 0 0 0 7.106-.932.75.75 0 0 1 1.274.727Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        {pageData.page === 'job-search' && (
          <SalaryView
            cards={pageData.salaryCards}
            salaryLoading={salaryLoading}
            onRequestAiEstimate={handleRequestAiEstimate}
            estimatingIndices={estimatingIndices}
          />
        )}
        {pageData.page === 'job-detail' && (
          <>
            {renderSalaryBadge()}
            <RealityCheckView jd={pageData.jd} />
          </>
        )}
        {pageData.page === 'profile' && <SmartConnectView profile={pageData.profile} />}
      </>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <Header />

      <main className="flex flex-col gap-4 px-4 py-4 flex-1 overflow-y-auto">
        {/* Resume section */}
        <section>
          <p className="text-[11px] font-semibold text-text-tertiary tracking-wide uppercase mb-2 px-1">
            Resume
          </p>
          {!resume ? (
            <ResumeUpload
              onFileSelect={handleFileUpload}
              uploading={uploading}
              error={error}
            />
          ) : (
            <ResumeStatus
              fileName={resume.fileName}
              onChange={handleChangeResume}
            />
          )}
        </section>

        {/* Features section */}
        <section>
          <p className="text-[11px] font-semibold text-text-tertiary tracking-wide uppercase mb-2 px-1">
            Features
          </p>
          <div className="rounded-xl border border-border bg-surface px-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <FeatureToggles
              showSalary={showSalary}
              enableConnect={enableConnect}
              onToggleSalary={handleToggleSalary}
              onToggleConnect={handleToggleConnect}
            />
          </div>
        </section>

        {/* Context-aware section */}
        <section className="pb-2">
          <div className="h-px bg-border-subtle mb-4" />
          {renderContextSection()}
        </section>
      </main>

      <Footer />
    </div>
  );
}
