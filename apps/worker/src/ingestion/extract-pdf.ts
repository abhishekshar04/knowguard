import { extractText, getDocumentProxy } from 'unpdf';

import { flattenParagraph, IngestionError, normalizeText, type TextBlock } from './blocks';

const MAX_PAGES = 2_000;

/**
 * PDF → blocks, one group per page so every chunk keeps its page numbers.
 *
 * The file is untrusted. The bundled pdf.js (6.x) contains no eval/`new Function` font path at
 * all, so the CVE-2024-4367 class of font-program exploits cannot apply; system fonts and
 * font-face injection are disabled as well. Scanned PDFs without a text layer yield no text;
 * OCR is out of scope and reported as such.
 */
export async function extractPdf(bytes: Buffer): Promise<TextBlock[]> {
  let pages: string[];
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes), {
      useSystemFonts: false,
      disableFontFace: true,
      stopAtErrors: false,
    });
    if (pdf.numPages > MAX_PAGES) {
      await pdf.cleanup();
      throw new IngestionError(`The PDF has more than ${MAX_PAGES} pages.`);
    }
    pages = (await extractText(pdf, { mergePages: false })).text;
    await pdf.cleanup();
  } catch (error) {
    if (error instanceof IngestionError) throw error;
    throw new IngestionError('The PDF could not be read. It may be corrupt or password-protected.', false, {
      cause: error,
    });
  }

  const blocks: TextBlock[] = [];
  pages.forEach((pageText, index) => {
    const page = index + 1;
    for (const part of normalizeText(pageText).split(/\n\s*\n/)) {
      const text = flattenParagraph(part);
      if (text) blocks.push({ kind: 'paragraph', text, page });
    }
  });
  return blocks;
}
