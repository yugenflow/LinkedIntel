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
      className={`relative flex h-[22px] w-[40px] cursor-pointer items-center rounded-full p-[2px] transition-all duration-200 ${
        checked ? 'bg-accent' : 'bg-zinc-200'
      }`}
    >
      <div
        className={`h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-[18px]' : 'translate-x-0'
        }`}
      />
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
    <div className="flex flex-col px-1">
      <div className="flex items-center justify-between py-2.5 gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-text-primary">Salary badges</p>
          <p className="text-[11px] text-text-tertiary leading-snug">
            Show estimates on job listings
          </p>
        </div>
        <Toggle checked={showSalary} onChange={onToggleSalary} />
      </div>

      <div className="h-px bg-border-subtle" />

      <div className="flex items-center justify-between py-2.5 gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-text-primary">Smart Connect</p>
          <p className="text-[11px] text-text-tertiary leading-snug">
            AI message suggestions on profiles
          </p>
        </div>
        <Toggle checked={enableConnect} onChange={onToggleConnect} />
      </div>
    </div>
  );
}
