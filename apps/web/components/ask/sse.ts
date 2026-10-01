import type { AiStreamEvent } from '@knowguard/types';

/**
 * Incremental parser for the Server-Sent Events of POST /ask/stream. Feed it decoded text as it
 * arrives; it returns the complete events and keeps any partial one for the next chunk.
 */
export function createSseParser() {
  let buffer = '';
  return (chunk: string): AiStreamEvent[] => {
    buffer += chunk.replace(/\r\n/g, '\n');
    const events: AiStreamEvent[] = [];
    let end = buffer.indexOf('\n\n');
    while (end !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      end = buffer.indexOf('\n\n');

      let name = '';
      const data: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) name = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
      }
      if (!name || data.length === 0) continue;
      try {
        events.push({ event: name, data: JSON.parse(data.join('\n')) } as AiStreamEvent);
      } catch {
        // A malformed event is skipped rather than breaking the whole answer.
      }
    }
    return events;
  };
}

const CITATION = /\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\]/g;

export type AnswerPart = { type: 'text'; text: string } | { type: 'cite'; indexes: number[]; raw: string };

/** Splits an answer into text and [n] citation markers (mirrors the API's citation parser). */
export function splitCitations(answer: string): AnswerPart[] {
  const parts: AnswerPart[] = [];
  let last = 0;
  for (const match of answer.matchAll(CITATION)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ type: 'text', text: answer.slice(last, start) });
    const indexes = (match[1] ?? '').split(',').map((n) => Number(n.trim()));
    parts.push({ type: 'cite', indexes, raw: match[0] });
    last = start + match[0].length;
  }
  if (last < answer.length) parts.push({ type: 'text', text: answer.slice(last) });
  return parts;
}
