import { IngestionError, normalizeText } from './blocks';
import { extractBlocks } from './extract';
import { assertSafeZip } from './extract-docx';
import { extractMarkdown } from './extract-text';
import { makeDocx, makePdf, makeZipBomb } from './fixtures';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('normalizeText', () => {
  it('normalizes unicode, strips control characters and joins PDF hyphenation', () => {
    expect(normalizeText('ﬁle\u0007 name  exam-\nple\r\nnext')).toBe('file name example\nnext');
  });
});

describe('extractMarkdown', () => {
  it('recognises ATX and setext headings, paragraphs, lists and fenced code', () => {
    const blocks = extractMarkdown(
      [
        '# Payments',
        '',
        'Intro paragraph',
        'continues here.',
        '',
        'Deployment',
        '----------',
        '- step one',
        '- step two',
        '',
        '```bash',
        'kubectl apply -f payments.yaml',
        '',
        '# not a heading inside code',
        '```',
      ].join('\n'),
    );
    expect(blocks).toEqual([
      { kind: 'heading', level: 1, text: 'Payments' },
      { kind: 'paragraph', text: 'Intro paragraph continues here.' },
      { kind: 'heading', level: 2, text: 'Deployment' },
      { kind: 'paragraph', text: '- step one' },
      { kind: 'paragraph', text: '- step two' },
      { kind: 'code', text: 'kubectl apply -f payments.yaml\n\n# not a heading inside code' },
    ]);
  });
});

describe('extractBlocks', () => {
  it('extracts PDF text page by page', async () => {
    const pdf = await makePdf([
      ['Payments Deployment Guide', 'Run the release pipeline.'],
      ['Rollback', 'Revert the release if checks fail.'],
    ]);
    const blocks = await extractBlocks(pdf, 'application/pdf');
    const byPage = (page: number) =>
      blocks
        .filter((b) => b.page === page)
        .map((b) => b.text)
        .join(' ');
    expect(byPage(1)).toContain('Run the release pipeline.');
    expect(byPage(2)).toContain('Revert the release if checks fail.');
  });

  it('extracts DOCX headings, paragraphs and tables', async () => {
    const docx = await makeDocx([
      { heading: 1, text: 'Security Policy' },
      { text: 'Passwords must be at least 12 characters & unique.' },
      { heading: 2, text: 'Retention' },
      {
        table: [
          ['Record', 'Years'],
          ['Invoices', '7'],
        ],
      },
    ]);
    const blocks = await extractBlocks(docx, DOCX);
    expect(blocks).toEqual([
      { kind: 'heading', level: 1, text: 'Security Policy' },
      { kind: 'paragraph', text: 'Passwords must be at least 12 characters & unique.' },
      { kind: 'heading', level: 2, text: 'Retention' },
      { kind: 'table', text: 'Record | Years\nInvoices | 7' },
    ]);
  });

  it('extracts plain text paragraphs', async () => {
    const blocks = await extractBlocks(Buffer.from('First paragraph.\n\nSecond\nparagraph.'), 'text/plain');
    expect(blocks.map((b) => b.text)).toEqual(['First paragraph.', 'Second paragraph.']);
  });

  it.each([
    ['a corrupt PDF', Buffer.from('%PDF-1.7 garbage'), 'application/pdf'],
    ['an empty text file', Buffer.from('   \n\n  '), 'text/plain'],
    ['a PDF without a text layer', null, 'application/pdf'],
    ['an unknown type', Buffer.from('x'), 'application/zip'],
  ])('rejects %s as a non-retryable ingestion error', async (_label, bytes, mime) => {
    const input = bytes ?? (await makePdf([[]]));
    await expect(extractBlocks(input, mime)).rejects.toBeInstanceOf(IngestionError);
  });
});

describe('assertSafeZip', () => {
  it('accepts a normal DOCX', async () => {
    expect(() => assertSafeZip(Buffer.alloc(0))).toThrow(IngestionError);
    const docx = await makeDocx([{ text: 'hello' }]);
    expect(() => assertSafeZip(docx)).not.toThrow();
  });

  it('rejects a decompression bomb before inflating it', async () => {
    const bomb = await makeZipBomb();
    expect(bomb.length).toBeLessThan(100 * 1024);
    expect(() => assertSafeZip(bomb)).toThrow('The Word document expands to an unsafe size.');
    await expect(extractBlocks(bomb, DOCX)).rejects.toThrow('unsafe size');
  });
});
