import { documentObjectKey, documentObjectPrefix } from './keys';

const ORG = '0199a0a0-0000-7000-8000-000000000001';
const DOC = '0199a0a0-0000-7000-8000-000000000002';
const VER = '0199a0a0-0000-7000-8000-000000000003';

describe('documentObjectKey', () => {
  it('builds the tenant-prefixed key from the specification', () => {
    expect(
      documentObjectKey({ organizationId: ORG, documentId: DOC, versionId: VER, extension: 'pdf' }),
    ).toBe(`organizations/${ORG}/documents/${DOC}/${VER}/original.pdf`);
  });

  it.each([
    ['organizationId', { organizationId: '../other-org' }],
    ['documentId', { documentId: `${DOC}/../../x` }],
    ['versionId', { versionId: '' }],
    ['extension', { extension: 'pdf/../../x' }],
    ['extension', { extension: 'PDF' }],
  ])('rejects a malicious or malformed %s', (_name, override) => {
    expect(() =>
      documentObjectKey({
        organizationId: ORG,
        documentId: DOC,
        versionId: VER,
        extension: 'pdf',
        ...override,
      }),
    ).toThrow();
  });

  it('keeps every version under the document prefix', () => {
    const key = documentObjectKey({ organizationId: ORG, documentId: DOC, versionId: VER, extension: 'txt' });
    expect(key.startsWith(documentObjectPrefix(ORG, DOC))).toBe(true);
  });
});
