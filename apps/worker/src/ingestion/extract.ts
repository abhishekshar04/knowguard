import { assertWithinLimit, IngestionError, type TextBlock } from './blocks';
import { extractDocx } from './extract-docx';
import { extractPdf } from './extract-pdf';
import { extractMarkdown, extractPlainText } from './extract-text';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Extract + normalize (spec §17), dispatched on the MIME type recorded at upload. */
export async function extractBlocks(bytes: Buffer, mimeType: string): Promise<TextBlock[]> {
  let blocks: TextBlock[];
  switch (mimeType) {
    case 'application/pdf':
      blocks = await extractPdf(bytes);
      break;
    case DOCX:
      blocks = await extractDocx(bytes);
      break;
    case 'text/markdown':
      blocks = extractMarkdown(decodeUtf8(bytes));
      break;
    case 'text/plain':
      blocks = extractPlainText(decodeUtf8(bytes));
      break;
    default:
      throw new IngestionError(`Unsupported document type ${mimeType}.`);
  }
  assertWithinLimit(blocks);
  if (!blocks.some((block) => block.kind !== 'heading')) {
    throw new IngestionError(
      'No text could be extracted. Scanned documents without a text layer are not supported yet.',
    );
  }
  return blocks;
}

function decodeUtf8(bytes: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, ''); // drop BOM
  } catch {
    throw new IngestionError('The text file is not valid UTF-8.');
  }
}
