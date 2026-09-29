const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXTENSION = /^[a-z0-9]{1,8}$/;

/**
 * Storage key for one immutable document version (spec §15):
 *   organizations/{organizationId}/documents/{documentId}/{versionId}/original.{ext}
 *
 * Every segment is validated, so a key can never escape its tenant prefix via "..", "/" or
 * encoded tricks — even if a caller passed an unexpected value.
 */
export function documentObjectKey(input: {
  organizationId: string;
  documentId: string;
  versionId: string;
  extension: string;
}): string {
  for (const [name, value] of Object.entries({
    organizationId: input.organizationId,
    documentId: input.documentId,
    versionId: input.versionId,
  })) {
    if (!UUID.test(value)) throw new Error(`Invalid ${name} for storage key`);
  }
  if (!EXTENSION.test(input.extension)) throw new Error('Invalid extension for storage key');
  return `organizations/${input.organizationId}/documents/${input.documentId}/${input.versionId}/original.${input.extension}`;
}

/** Prefix under which ALL of a document's versions live. */
export function documentObjectPrefix(organizationId: string, documentId: string): string {
  if (!UUID.test(organizationId) || !UUID.test(documentId)) throw new Error('Invalid ID for storage prefix');
  return `organizations/${organizationId}/documents/${documentId}/`;
}
