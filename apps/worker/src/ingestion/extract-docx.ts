import mammoth from 'mammoth';

import { flattenParagraph, IngestionError, type TextBlock } from './blocks';

/** Guards against decompression bombs before the DOCX (a ZIP) is unpacked. */
const MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 200;
const MAX_ENTRIES = 5_000;

/**
 * Sums the uncompressed sizes declared in the ZIP central directory without inflating anything.
 * Throws on archives that would expand too far (absolute size or ratio) or are malformed.
 */
export function assertSafeZip(bytes: Buffer): void {
  const EOCD = 0x06054b50;
  const CENTRAL = 0x02014b50;
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (bytes.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new IngestionError('The Word document is not a valid ZIP archive.');

  const entries = bytes.readUInt16LE(eocd + 10);
  let offset = bytes.readUInt32LE(eocd + 16);
  if (entries > MAX_ENTRIES) throw new IngestionError('The Word document has too many parts.');

  let total = 0;
  for (let n = 0; n < entries; n++) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== CENTRAL) {
      throw new IngestionError('The Word document is corrupt.');
    }
    total += bytes.readUInt32LE(offset + 24);
    offset +=
      46 +
      bytes.readUInt16LE(offset + 28) +
      bytes.readUInt16LE(offset + 30) +
      bytes.readUInt16LE(offset + 32);
  }
  if (total > MAX_UNCOMPRESSED_BYTES || total > bytes.length * MAX_COMPRESSION_RATIO) {
    throw new IngestionError('The Word document expands to an unsafe size.');
  }
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decode(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
      if (entity[0] === '#') {
        const code =
          entity[1]?.toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
      }
      return ENTITIES[entity.toLowerCase()] ?? match;
    });
}

/**
 * DOCX → blocks. mammoth converts Word styles to semantic HTML (Heading 1 → <h1>, lists,
 * tables); that small, well-formed subset is mapped to blocks. Images are dropped.
 */
export async function extractDocx(bytes: Buffer): Promise<TextBlock[]> {
  assertSafeZip(bytes);
  let html: string;
  try {
    html = (
      await mammoth.convertToHtml(
        { buffer: bytes },
        { convertImage: mammoth.images.imgElement(async () => ({ src: '' })) },
      )
    ).value;
  } catch (error) {
    throw new IngestionError('The Word document could not be read. It may be corrupt.', false, {
      cause: error,
    });
  }

  const blocks: TextBlock[] = [];
  const element = /<(h[1-6]|p|li|table)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const match of html.matchAll(element)) {
    const [, rawTag = '', inner = ''] = match;
    const tag = rawTag.toLowerCase();
    if (tag === 'table') {
      const rows = [...inner.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(([, row = '']) =>
        [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
          .map(([, cell = '']) => flattenParagraph(decode(cell)))
          .join(' | '),
      );
      const text = rows.filter(Boolean).join('\n');
      if (text) blocks.push({ kind: 'table', text });
      continue;
    }
    const text = flattenParagraph(decode(inner));
    if (!text) continue;
    if (tag.startsWith('h')) blocks.push({ kind: 'heading', level: Number(tag[1]), text });
    else blocks.push({ kind: 'paragraph', text });
  }
  return blocks;
}
