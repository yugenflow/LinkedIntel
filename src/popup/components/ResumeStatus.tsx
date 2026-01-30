interface Props {
  fileName: string;
  onChange: () => void;
}

export default function ResumeStatus({ fileName, onChange }: Props) {
  return (
    <div className="p-2">
      <div className="flex flex-1 items-center justify-between gap-4 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <svg className="size-4 text-primary" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
            </svg>
            <p className="text-text-primary text-sm font-bold">Resume Active</p>
          </div>
          <p className="text-text-secondary text-xs font-medium pl-6">{fileName}</p>
        </div>
        <button
          onClick={onChange}
          className="flex cursor-pointer items-center justify-center rounded-full h-8 px-4 bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-all"
        >
          Change
        </button>
      </div>
    </div>
  );
}
