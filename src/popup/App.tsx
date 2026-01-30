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
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-text-secondary">
          <span className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Detecting page...
        </div>
      );
    }

    if (!pageData || pageData.page === 'other') {
      return (
        <div className="flex flex-col items-center gap-2 py-4 px-2">
          <p className="text-xs text-text-secondary text-center">
            Navigate to a LinkedIn job search, job posting, or profile to use contextual features.
          </p>
          <button
            onClick={handleRefresh}
            className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.106.932.75.75 0 0 1-1.317-.72 6 6 0 0 1 9.475-1.242l.842.84V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.475 1.242l-.842-.84v1.371a.75.75 0 0 1-1.5 0V9.591a.75.75 0 0 1 .75-.75h3.182a.75.75 0 0 1 0 1.5h-1.37l.84.841a4.5 4.5 0 0 0 7.106-.932.75.75 0 0 1 1.274.727Z" clipRule="evenodd" />
            </svg>
            Refresh
          </button>
        </div>
      );
    }

    return (
      <>
        <div className="flex items-center justify-between px-1 pb-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
            {pageData.page === 'job-search' && 'Salary Intel'}
            {pageData.page === 'job-detail' && 'Reality Check'}
            {pageData.page === 'profile' && 'Smart Connect'}
          </h3>
          <button
            onClick={handleRefresh}
            title="Refresh page data"
            className="text-text-secondary hover:text-primary transition-colors p-1 -mr-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
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
    <div className="flex flex-col min-h-screen bg-white">
      <Header />

      <main className="flex flex-col gap-2 p-4 flex-1 overflow-y-auto">
        <h3 className="text-text-primary text-sm font-bold uppercase tracking-wider px-2 pt-2">
          Resume Matching
        </h3>

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

        <h3 className="text-text-primary text-sm font-bold uppercase tracking-wider px-2 pt-4">
          Extension Features
        </h3>

        <FeatureToggles
          showSalary={showSalary}
          enableConnect={enableConnect}
          onToggleSalary={handleToggleSalary}
          onToggleConnect={handleToggleConnect}
        />

        {/* Context-aware section based on active LinkedIn page */}
        <div className="border-t border-border mt-2 pt-2">
          {renderContextSection()}
        </div>
      </main>

      <Footer />
    </div>
  );
}
