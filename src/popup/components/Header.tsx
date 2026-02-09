export default function Header() {
  return (
    <header className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle bg-surface">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-accent text-white">
          <svg width="16" height="16" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* L */}
            <rect x="14" y="18" width="14" height="64" rx="2" fill="white"/>
            <rect x="14" y="68" width="30" height="14" rx="2" fill="white"/>
            {/* I */}
            <rect x="54" y="18" width="32" height="14" rx="2" fill="white"/>
            <rect x="63" y="18" width="14" height="64" rx="2" fill="white"/>
            <rect x="54" y="68" width="32" height="14" rx="2" fill="white"/>
          </svg>
        </div>
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-text-primary">
          LinkedIntel
        </span>
        <span className="text-[10px] font-medium text-accent bg-accent-subtle px-1.5 py-0.5 rounded-full">
          beta
        </span>
      </div>
    </header>
  );
}
