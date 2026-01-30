export default function Footer() {
  return (
    <footer className="px-5 py-3 flex items-center justify-between border-t border-border-subtle">
      <span className="text-[11px] text-text-tertiary">
        v1.0.0
      </span>
      <div className="flex items-center gap-4">
        <a className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors" href="#">
          Help
        </a>
        <a className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors" href="#">
          Dashboard
        </a>
      </div>
    </footer>
  );
}
