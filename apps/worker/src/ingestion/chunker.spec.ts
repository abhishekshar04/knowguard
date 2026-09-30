import type { TextBlock } from './blocks';
import { DEFAULT_CHUNK_OPTIONS, estimateTokens, SectionChunker } from './chunker';

const chunker = new SectionChunker();
const sentence = (i: number) => `Sentence number ${i} explains one careful step of the deployment procedure.`;
const paragraph = (n: number, offset = 0) =>
  Array.from({ length: n }, (_, i) => sentence(i + offset)).join(' ');

describe('SectionChunker', () => {
  it('keeps small sections whole and records the heading path', () => {
    const blocks: TextBlock[] = [
      { kind: 'heading', level: 1, text: 'Payments' },
      { kind: 'heading', level: 2, text: 'Deployment' },
      { kind: 'paragraph', text: 'Merge to main, then promote the release.' },
      { kind: 'heading', level: 2, text: 'Rollback' },
      { kind: 'paragraph', text: 'Revert the release in the pipeline.' },
    ];
    const chunks = chunker.chunk(blocks);
    expect(chunks.map((c) => c.content)).toEqual([
      'Merge to main, then promote the release.',
      'Revert the release in the pipeline.',
    ]);
    expect(chunks[0]!.metadata).toMatchObject({
      headingPath: ['Payments', 'Deployment'],
      heading: 'Deployment',
      section: 'Payments > Deployment',
    });
    // A sibling heading replaces, not nests under, the previous one.
    expect(chunks[1]!.metadata.headingPath).toEqual(['Payments', 'Rollback']);
  });

  it('never merges text across a heading', () => {
    const chunks = chunker.chunk([
      { kind: 'heading', level: 1, text: 'A' },
      { kind: 'paragraph', text: 'Alpha.' },
      { kind: 'heading', level: 1, text: 'B' },
      { kind: 'paragraph', text: 'Beta.' },
    ]);
    expect(chunks).toHaveLength(2);
    expect(chunks.every((c) => !(c.content.includes('Alpha') && c.content.includes('Beta')))).toBe(true);
  });

  it('respects the size ceiling and splits long paragraphs at sentence boundaries', () => {
    const chunks = chunker.chunk([{ kind: 'paragraph', text: paragraph(200) }]);
    expect(chunks.length).toBeGreaterThan(5);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(DEFAULT_CHUNK_OPTIONS.maxTokens);
      expect(chunk.content.endsWith('.')).toBe(true); // no mid-sentence cuts
    }
  });

  it('overlaps a little context between consecutive chunks of a section', () => {
    const chunks = chunker.chunk([
      { kind: 'paragraph', text: paragraph(12) },
      { kind: 'paragraph', text: paragraph(12, 12) },
      { kind: 'paragraph', text: paragraph(12, 24) },
    ]);
    expect(chunks.length).toBeGreaterThan(1);
    // The next chunk opens with trailing sentences repeated from the end of the previous one.
    const opening = chunks[1]!.content.split('\n\n')[0]!;
    expect(chunks[0]!.content.endsWith(opening)).toBe(true);
    expect(estimateTokens(opening)).toBeLessThanOrEqual(DEFAULT_CHUNK_OPTIONS.overlapTokens);
  });

  it('tracks page ranges across pages', () => {
    const chunks = chunker.chunk([
      { kind: 'paragraph', text: 'Intro on page one.', page: 1 },
      { kind: 'paragraph', text: 'Continues on page two.', page: 2 },
      { kind: 'paragraph', text: paragraph(60), page: 3 },
    ]);
    expect(chunks[0]!.metadata).toMatchObject({ pageStart: 1, pageNumber: 1 });
    expect(chunks.at(-1)!.metadata.pageEnd).toBe(3);
  });

  it('keeps code blocks intact line-wise and never adds prose overlap to code', () => {
    const code = Array.from({ length: 300 }, (_, i) => `const value${i} = compute(${i});`).join('\n');
    const chunks = chunker.chunk([{ kind: 'code', text: code }]);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      for (const line of chunk.content.split('\n'))
        expect(line).toMatch(/^const value\d+ = compute\(\d+\);$/);
    }
  });

  it('hard-splits a single enormous word-free line', () => {
    const chunks = chunker.chunk([{ kind: 'paragraph', text: 'x'.repeat(10_000) }]);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => estimateTokens(c.content) <= DEFAULT_CHUNK_OPTIONS.maxTokens)).toBe(true);
  });

  it('produces nothing for headings without text', () => {
    expect(chunker.chunk([{ kind: 'heading', level: 1, text: 'Empty' }])).toEqual([]);
  });
});
