export interface DetectedFileType {
  mimeType: string;
  /** Used for the storage key; never taken from the client's filename verbatim. */
  extension: 'pdf' | 'docx' | 'txt' | 'md';
}

const PDF_MAGIC = Buffer.from('%PDF-');
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Identifies an upload from its BYTES (the client's Content-Type and filename are not
 * trusted). Returns null for anything outside the supported set, which the API rejects:
 *  - PDF:      "%PDF-" signature
 *  - DOCX:     ZIP container that contains "word/document.xml" and a .docx filename
 *  - Markdown / plain text: valid UTF-8 without NUL bytes (.md/.markdown → Markdown)
 * Phase 6 extraction supports exactly these formats.
 */
export function detectFileType(bytes: Buffer, originalFilename: string): DetectedFileType | null {
  if (bytes.length === 0) return null;
  const name = originalFilename.toLowerCase();

  if (bytes.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
    return { mimeType: 'application/pdf', extension: 'pdf' };
  }
  if (bytes.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC)) {
    // ZIP stores entry names uncompressed, so the main DOCX part is findable without unzipping.
    const isDocx = name.endsWith('.docx') && bytes.includes('word/document.xml');
    return isDocx ? { mimeType: DOCX_MIME, extension: 'docx' } : null;
  }
  if (isUtf8Text(bytes)) {
    return name.endsWith('.md') || name.endsWith('.markdown')
      ? { mimeType: 'text/markdown', extension: 'md' }
      : { mimeType: 'text/plain', extension: 'txt' };
  }
  return null;
}

function isUtf8Text(bytes: Buffer): boolean {
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/** Filename shown on download: basename only, safe characters, bounded length. */
export function sanitizeFilename(original: string, fallbackExtension: string): string {
  const base = original.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._ -]/gu, '_')
    .replace(/^[.\s]+/, '')
    .slice(0, 200)
    .trim();
  return cleaned || `document.${fallbackExtension}`;
}
