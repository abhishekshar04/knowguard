import { detectFileType, sanitizeFilename } from './file-type';

const zipWith = (entry: string) =>
  Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(`....${entry}....`)]);

describe('detectFileType', () => {
  it('detects PDF by signature regardless of the filename', () => {
    expect(detectFileType(Buffer.from('%PDF-1.7\n...'), 'report.txt')).toEqual({
      mimeType: 'application/pdf',
      extension: 'pdf',
    });
  });

  it('detects DOCX only for ZIPs containing the Word main part and a .docx name', () => {
    expect(detectFileType(zipWith('word/document.xml'), 'spec.docx')?.extension).toBe('docx');
    expect(detectFileType(zipWith('word/document.xml'), 'spec.zip')).toBeNull();
    expect(detectFileType(zipWith('xl/workbook.xml'), 'book.docx')).toBeNull();
  });

  it('treats valid UTF-8 as text, choosing Markdown by extension', () => {
    expect(detectFileType(Buffer.from('# Title\nbody'), 'notes.md')?.mimeType).toBe('text/markdown');
    expect(detectFileType(Buffer.from('plain ünïcödé'), 'notes.txt')?.mimeType).toBe('text/plain');
  });

  it.each([
    ['an executable', Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]), 'invoice.pdf'],
    ['binary with NUL bytes', Buffer.from([0x41, 0x00, 0x42]), 'notes.txt'],
    ['invalid UTF-8', Buffer.from([0xff, 0xfe, 0xfd]), 'notes.txt'],
    ['an empty file', Buffer.alloc(0), 'empty.txt'],
    ['a PNG renamed to .pdf', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]), 'scan.pdf'],
  ])('rejects %s', (_label, bytes, name) => {
    expect(detectFileType(bytes, name)).toBeNull();
  });
});

describe('sanitizeFilename', () => {
  it.each([
    ['../../etc/passwd', 'passwd'],
    ['C:\\Users\\me\\Q3 Report.pdf', 'Q3 Report.pdf'],
    ['.hidden', 'hidden'],
    ['evil"; filename=x.exe', 'evil__ filename_x.exe'],
    ['', 'document.pdf'],
  ])('%p → %p', (input, expected) => {
    expect(sanitizeFilename(input, 'pdf')).toBe(expected);
  });
});
