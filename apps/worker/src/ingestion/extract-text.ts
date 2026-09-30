import { flattenParagraph, normalizeText, type TextBlock } from './blocks';

const FENCE = /^(```|~~~)/;
const ATX_HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const SETEXT_UNDERLINE = /^(=+|-+)\s*$/;

/**
 * Markdown → blocks. Handles ATX (#) and setext (===/---) headings, fenced code blocks (kept
 * verbatim and never merged with prose), and blank-line-separated paragraphs/lists.
 */
export function extractMarkdown(source: string): TextBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: TextBlock[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    const text = flattenParagraph(paragraph.join('\n'));
    if (text) blocks.push({ kind: 'paragraph', text });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    const fence = FENCE.exec(line.trim());
    if (fence) {
      flush();
      const marker = fence[1] ?? '```';
      const code: string[] = [];
      for (i++; i < lines.length && !(lines[i] ?? '').trim().startsWith(marker); i++)
        code.push(lines[i] ?? '');
      const text = code.join('\n').replace(/\s+$/, '');
      if (text.trim()) blocks.push({ kind: 'code', text });
      continue;
    }

    const atx = ATX_HEADING.exec(line);
    if (atx) {
      flush();
      const [, hashes = '#', title = ''] = atx;
      blocks.push({ kind: 'heading', level: hashes.length, text: flattenParagraph(title) });
      continue;
    }

    const next = lines[i + 1];
    if (line.trim() && paragraph.length === 0 && next !== undefined && SETEXT_UNDERLINE.test(next)) {
      blocks.push({
        kind: 'heading',
        level: next.trim().startsWith('=') ? 1 : 2,
        text: flattenParagraph(line),
      });
      i++;
      continue;
    }

    if (!line.trim()) {
      flush();
      continue;
    }
    // Keep list items as their own paragraphs so they are not glued together.
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line) && paragraph.length > 0) flush();
    paragraph.push(line);
  }
  flush();
  return blocks;
}

/** Plain text → paragraphs separated by blank lines. No headings. */
export function extractPlainText(source: string): TextBlock[] {
  return normalizeText(source)
    .split(/\n\s*\n/)
    .map((part) => flattenParagraph(part))
    .filter(Boolean)
    .map((text) => ({ kind: 'paragraph' as const, text }));
}
