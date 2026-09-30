import type { TextBlock } from './blocks';

export interface ChunkMetadata {
  /** Headings enclosing the chunk, outermost first. */
  headingPath: string[];
  heading: string | null;
  /** headingPath joined with " > ", for display and embedding context. */
  section: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  /** First page, under the name the specification uses (§18). */
  pageNumber: number | null;
}

export interface DraftChunk {
  content: string;
  tokenCount: number;
  metadata: ChunkMetadata;
}

export interface ChunkOptions {
  /** Preferred chunk size. */
  targetTokens: number;
  /** Hard ceiling (the embedding model truncates at 512 tokens). */
  maxTokens: number;
  /** Trailing context repeated at the start of the next chunk in the same section. */
  overlapTokens: number;
}

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = { targetTokens: 320, maxTokens: 450, overlapTokens: 48 };

/**
 * A replaceable chunking strategy (spec §19). Swap the implementation without touching the
 * pipeline, e.g. for a model-tokenizer-based or layout-aware chunker.
 */
export interface Chunker {
  chunk(blocks: readonly TextBlock[]): DraftChunk[];
}

/** ~4 characters per token for English prose; conservative enough for the 512-token model limit. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

interface Piece {
  text: string;
  page: number | undefined;
  /** Code is never joined across pieces with prose-style spacing. */
  code: boolean;
}

/**
 * Semantic, heading-aware chunker:
 *  - a heading closes the current chunk; chunks never span two sections;
 *  - paragraphs are kept whole when they fit, otherwise split at sentence boundaries, and only
 *    as a last resort at word boundaries; code blocks split at line boundaries;
 *  - each chunk records its heading path and page range;
 *  - a little trailing context overlaps into the next chunk of the same section.
 */
export class SectionChunker implements Chunker {
  constructor(private readonly options: ChunkOptions = DEFAULT_CHUNK_OPTIONS) {}

  chunk(blocks: readonly TextBlock[]): DraftChunk[] {
    const chunks: DraftChunk[] = [];
    const headings: Array<{ level: number; text: string }> = [];
    let buffer: Piece[] = [];
    let bufferTokens = 0;

    const metadata = (pieces: Piece[]): ChunkMetadata => {
      const pages = pieces.map((p) => p.page).filter((p): p is number => p !== undefined);
      const path = headings.map((h) => h.text);
      const pageStart = pages.length ? Math.min(...pages) : null;
      return {
        headingPath: path,
        heading: path.at(-1) ?? null,
        section: path.length ? path.join(' > ') : null,
        pageStart,
        pageEnd: pages.length ? Math.max(...pages) : null,
        pageNumber: pageStart,
      };
    };

    const emit = (pieces: Piece[]) => {
      const content = join(pieces);
      if (!content.trim()) return;
      chunks.push({ content, tokenCount: estimateTokens(content), metadata: metadata(pieces) });
    };

    const flush = (keepOverlap: boolean) => {
      if (buffer.length === 0) return;
      emit(buffer);
      const tail = keepOverlap ? this.overlap(buffer) : [];
      buffer = tail;
      bufferTokens = tail.reduce((sum, p) => sum + estimateTokens(p.text), 0);
    };

    for (const block of blocks) {
      if (block.kind === 'heading') {
        flush(false);
        while ((headings.at(-1)?.level ?? 0) >= block.level) headings.pop();
        headings.push({ level: block.level, text: block.text });
        continue;
      }
      for (const piece of this.split(block)) {
        const tokens = estimateTokens(piece.text);
        if (bufferTokens > 0 && bufferTokens + tokens > this.options.targetTokens) flush(true);
        // Overlap never makes a chunk exceed the ceiling.
        if (bufferTokens + tokens > this.options.maxTokens) {
          buffer = [];
          bufferTokens = 0;
        }
        buffer.push(piece);
        bufferTokens += tokens;
      }
    }
    flush(false);
    return chunks;
  }

  /** Splits one block into pieces that each fit maxTokens. */
  private split(block: Exclude<TextBlock, { kind: 'heading' }>): Piece[] {
    const code = block.kind === 'code' || block.kind === 'table';
    const make = (text: string): Piece => ({ text, page: block.page, code });
    if (estimateTokens(block.text) <= this.options.maxTokens) return [make(block.text)];

    const units = code ? block.text.split('\n') : sentences(block.text);
    const pieces: string[] = [];
    let current = '';
    for (const unit of units.flatMap((u) => this.hardSplit(u))) {
      const candidate = current ? `${current}${code ? '\n' : ' '}${unit}` : unit;
      if (estimateTokens(candidate) > this.options.maxTokens && current) {
        pieces.push(current);
        current = unit;
      } else {
        current = candidate;
      }
    }
    if (current) pieces.push(current);
    return pieces.map(make);
  }

  /** Last resort for a single sentence/line longer than the ceiling: split between words. */
  private hardSplit(text: string): string[] {
    const maxChars = this.options.maxTokens * 4;
    if (text.length <= maxChars) return [text];
    const parts: string[] = [];
    let rest = text;
    while (rest.length > maxChars) {
      let cut = rest.lastIndexOf(' ', maxChars);
      if (cut < maxChars / 2) cut = maxChars; // no usable space: split mid-token
      parts.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) parts.push(rest);
    return parts;
  }

  /** Trailing sentences of the previous chunk, up to overlapTokens (prose only). */
  private overlap(pieces: Piece[]): Piece[] {
    const last = pieces.at(-1);
    if (!last || last.code || this.options.overlapTokens <= 0) return [];
    const tail: string[] = [];
    let tokens = 0;
    for (const sentence of sentences(last.text).reverse()) {
      const next = estimateTokens(sentence);
      if (tokens + next > this.options.overlapTokens) break;
      tail.unshift(sentence);
      tokens += next;
    }
    return tail.length ? [{ text: tail.join(' '), page: last.page, code: false }] : [];
  }
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+(?=[\p{Lu}\p{N}"'(])/u).filter(Boolean);
}

function join(pieces: readonly Piece[]): string {
  return pieces
    .map((piece) => piece.text)
    .join('\n\n')
    .trim();
}
