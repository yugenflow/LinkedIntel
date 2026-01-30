interface Props {
  showSalary: boolean;
  enableConnect: boolean;
  onToggleSalary: (value: boolean) => void;
  onToggleConnect: (value: boolean) => void;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative flex h-7 w-12 cursor-pointer items-center rounded-full p-0.5 transition-all ${
        checked ? 'bg-primary justify-end' : 'bg-border-light justify-start'
      }`}
    >
      <div className="h-6 w-6 rounded-full bg-white shadow-md transition-transform" />
    </button>
  );
}

export default function FeatureToggles({
  showSalary,
  enableConnect,
  onToggleSalary,
  onToggleConnect,
}: Props) {
  return (
    <div className="flex flex-col gap-1 px-2 pb-4">
      <div className="flex items-center gap-4 min-h-16 py-2 justify-between border-b border-border-light">
        <div className="flex flex-col justify-center">
          <p className="text-text-primary text-sm font-bold">Show Salary Badges</p>
          <p className="text-text-secondary text-[11px] font-normal leading-tight max-w-[240px]">
            Displays salary estimates directly on LinkedIn job profiles
          </p>
        </div>
        <div className="shrink-0">
          <Toggle checked={showSalary} onChange={onToggleSalary} />
        </div>
      </div>

      <div className="flex items-center gap-4 min-h-16 py-2 justify-between">
        <div className="flex flex-col justify-center">
          <p className="text-text-primary text-sm font-bold">Enable Smart Connect</p>
          <p className="text-text-secondary text-[11px] font-normal leading-tight max-w-[240px]">
            AI-powered personalized message suggestions for networking
          </p>
        </div>
        <div className="shrink-0">
          <Toggle checked={enableConnect} onChange={onToggleConnect} />
        </div>
      </div>
    </div>
  );
}
