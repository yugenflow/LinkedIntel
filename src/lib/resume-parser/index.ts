import type { ParsedResume } from '../types';
import { parsePDF } from './pdf-parser';
import { parseDOCX } from './docx-parser';

export async function parseResume(file: File): Promise<ParsedResume> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  let text: string;
  let fileType: ParsedResume['fileType'];

  switch (ext) {
    case 'pdf':
      text = await parsePDF(file);
      fileType = 'pdf';
      break;
    case 'docx':
      text = await parseDOCX(file);
      fileType = 'docx';
      break;
    case 'doc':
      throw new Error(
        'Legacy .doc format is not supported. Please convert your file to .docx or .pdf and try again.'
      );
    default:
      throw new Error(
        `Unsupported file format: .${ext}. Please upload a PDF or DOCX file.`
      );
  }

  if (!text.trim()) {
    throw new Error(
      'Could not extract text from this file. It may be scanned/image-based. Please try a different file.'
    );
  }

  return {
    text: text.trim(),
    fileName: file.name,
    fileType,
    parsedAt: Date.now(),
  };
}
