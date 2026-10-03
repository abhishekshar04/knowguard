/**
 * Audit metadata hygiene (spec §28: no secrets, passwords, tokens or unnecessarily sensitive
 * content). Callers pass small, deliberate details; this is the safety net in case one ever
 * passes too much.
 */
/**
 * A key is sensitive when its last word names a secret or free text: `password`, `sessionToken`,
 * `apiKey`, `question`… Counters and identifiers that merely contain such words (`promptTokens`,
 * `messageId`) are kept.
 */
const SENSITIVE_SUFFIX =
  /(password|passwd|secret|token|apikey|authorization|authorisation|cookie|credential|credentials|question|query|content|answer|prompt|snippet|message|text|body)$/;
const isSensitiveKey = (key: string): boolean =>
  SENSITIVE_SUFFIX.test(key.toLowerCase().replace(/[^a-z]/g, ''));
const MAX_DEPTH = 3;
const MAX_STRING = 200;
const MAX_ARRAY = 50;
const MAX_BYTES = 4_096;

function clean(value: unknown, depth: number): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return '[nested]';
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY).map((item) => clean(item, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === undefined) continue;
      out[key] = isSensitiveKey(key) ? '[redacted]' : clean(item, depth + 1);
    }
    return out;
  }
  return undefined; // functions, symbols, bigint: never recorded
}

export function sanitizeAuditMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!metadata) return {};
  const cleaned = clean(metadata, 0) as Record<string, unknown>;
  return JSON.stringify(cleaned).length > MAX_BYTES ? { truncated: true } : cleaned;
}
