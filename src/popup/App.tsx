import { useState, useEffect, useCallback } from 'react';
import type { ParsedResume, PageDataPayload } from '../lib/types';
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

    chrome.runtime.sendMessage({ type: 'REQUEST_SCRAPE' }).catch(() => {
      // No content script available
    });

    // Timeout: if no response in 3s, stop loading
    const timeout = setTimeout(() => {
      setScrapeLoading(false);
    }, 3000);

    return timeout;
  }, []);

  // Listen for PAGE_DATA and do initial scrape on mount
  useEffect(() => {
    const listener = (message: { type: string; payload?: PageDataPayload }) => {
      if (message.type === 'PAGE_DATA' && message.payload) {
        setPageData(message.payload);
        setScrapeLoading(false);
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
        {pageData.page === 'job-search' && <SalaryView cards={pageData.salaryCards} />}
        {pageData.page === 'job-detail' && <RealityCheckView jd={pageData.jd} />}
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
