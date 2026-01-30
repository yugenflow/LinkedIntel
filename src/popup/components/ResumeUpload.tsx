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
    <div className="flex flex-col p-2">
      <div
        className={`flex flex-col items-center gap-4 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer group transition-colors ${
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-border bg-bg-light/30 hover:border-primary'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <div className="flex gap-4">
          {/* PDF icon */}
          <svg className="size-9 text-gray-400 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          {/* DOCX icon */}
          <svg className="size-9 text-gray-400 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </div>

        <div className="flex max-w-[280px] flex-col items-center gap-1">
          <p className="text-text-primary text-base font-bold text-center">
            Upload Resume (PDF, DOCX)
          </p>
          <p className="text-text-secondary text-xs font-normal text-center">
            Drag and drop or click to browse
          </p>
        </div>

        <button
          type="button"
          className="flex min-w-[120px] cursor-pointer items-center justify-center rounded-full h-10 px-5 bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all"
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          disabled={uploading}
        >
          {uploading ? 'Parsing...' : 'Browse Files'}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {error && (
        <p className="text-red-500 text-xs mt-2 px-2">{error}</p>
      )}
    </div>
  );
}
