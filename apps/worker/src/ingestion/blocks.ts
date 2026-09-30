/**
 * Format-neutral output of text extraction: an ordered list of blocks. Extractors (PDF, DOCX,
 * Markdown, text) produce blocks; the chunker consumes them. Pages are 1-based where known.
 */
export type TextBlock =
  | { kind: 'heading'; level: number; text: string; page?: number }
  | { kind: 'paragraph' | 'code' | 'table'; text: string; page?: number };

/** A failure that retrying cannot fix (unsupported, corrupt, empty or oversized content). */
export class IngestionError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
    /** The underlying error, for worker logs only (the message above is what users see). */
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'IngestionError';
  }
}

/** Upper bound on extracted text, so hostile or pathological files can't exhaust the worker. */
export const MAX_EXTRACTED_CHARS = 5_000_000;

/**
 * Unicode NFKC, control characters removed (tabs/newlines kept), whitespace tidied, and
 * end-of-line hyphenation from PDFs joined ("exam-\nple" → "example").
 */
export function normalizeText(text: string): string {
  return (
    text
      .normalize('NFKC')
      // eslint-disable-next-line no-control-regex -- deliberately strips control characters
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      .replace(/\r\n?/g, '\n')
      .replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2')
      .replace(/[ \t\u00a0]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .trim()
  );
}

/** Collapses a paragraph onto one line (layout line breaks carry no meaning). */
export function flattenParagraph(text: string): string {
  return normalizeText(text).replace(/\s*\n\s*/g, ' ');
}

export function assertWithinLimit(blocks: readonly TextBlock[]): void {
  const total = blocks.reduce((sum, block) => sum + block.text.length, 0);
  if (total > MAX_EXTRACTED_CHARS) {
    throw new IngestionError('The document contains too much text to index.');
  }
}
