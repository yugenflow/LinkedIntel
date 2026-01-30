import { useRef, useState, type DragEvent } from 'react';

interface Props {
  onFileSelect: (file: File) => void;
  uploading: boolean;
  error: string | null;
}

export default function ResumeUpload({ onFileSelect, uploading, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleClick = () => inputRef.current?.click();

  const handleChange = () => {
    const file = inputRef.current?.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <div className="px-1">
      <div
        className={`flex flex-col items-center gap-3 rounded-xl border border-dashed px-5 py-7 cursor-pointer group transition-all duration-200 ${
          dragOver
            ? 'border-accent bg-accent-subtle scale-[0.99]'
            : 'border-border hover:border-accent/40 bg-surface-sunken/50 hover:bg-accent-subtle/30'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-surface border border-border shadow-sm group-hover:shadow-md group-hover:border-accent/30 transition-all duration-200">
          <svg className="w-5 h-5 text-text-tertiary group-hover:text-accent transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13" />
          </svg>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <p className="text-[13px] font-medium text-text-primary">
            {uploading ? 'Parsing resume...' : 'Upload your resume'}
          </p>
          <p className="text-[11px] text-text-tertiary">
            PDF or DOCX — drag & drop or click
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {error && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-danger-light text-danger text-[12px]">
          {error}
        </div>
      )}
    </div>
  );
}
