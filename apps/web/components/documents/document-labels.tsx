import type { DocumentStatusValue, DocumentVisibilityValue } from '@knowguard/types';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const VISIBILITY_OPTIONS: ReadonlyArray<{
  value: DocumentVisibilityValue;
  label: string;
  hint: string;
}> = [
  { value: 'PRIVATE', label: 'Private', hint: 'Only you.' },
  { value: 'CUSTOM', label: 'Specific people', hint: 'Only those you share with explicitly.' },
  { value: 'TEAM', label: 'Teams', hint: 'Members of the chosen teams.' },
  { value: 'DEPARTMENT', label: 'Departments', hint: 'Members of the chosen departments.' },
  { value: 'ROLE', label: 'Roles', hint: 'Holders of the chosen roles.' },
  { value: 'ORGANIZATION', label: 'Whole organization', hint: 'Every member.' },
];

export function visibilityLabel(value: DocumentVisibilityValue): string {
  return VISIBILITY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

const STATUS: Record<
  DocumentStatusValue,
  { label: string; variant: 'success' | 'info' | 'destructive' | 'outline'; busy?: boolean }
> = {
  UPLOADING: { label: 'uploading', variant: 'outline', busy: true },
  PROCESSING: { label: 'processing', variant: 'info', busy: true },
  INDEXING: { label: 'indexing', variant: 'info', busy: true },
  READY: { label: 'ready', variant: 'success' },
  FAILED: { label: 'failed', variant: 'destructive' },
  ARCHIVED: { label: 'archived', variant: 'outline' },
};

export function StatusBadge({ status }: { status: DocumentStatusValue }) {
  const { label, variant, busy } = STATUS[status];
  return (
    <Badge variant={variant} data-testid="document-status">
      <span aria-hidden className={cn('size-1.5 rounded-full bg-current', busy && 'animate-pulse')} />
      {label}
    </Badge>
  );
}

const KINDS: Array<{ test: (mime: string) => boolean; label: string; className: string }> = [
  { test: (m) => m === 'application/pdf', label: 'PDF', className: 'bg-[#fdecec] text-[#c4323a]' },
  { test: (m) => m.includes('wordprocessingml'), label: 'DOC', className: 'bg-signal-soft text-signal' },
  { test: (m) => m.includes('markdown'), label: 'MD', className: 'bg-[#eaf5ef] text-success' },
];

/** A small tile naming the file type (PDF, DOC, MD, TXT), so lists scan at a glance. */
export function DocumentIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  const kind = KINDS.find((k) => k.test(mimeType)) ?? {
    label: 'TXT',
    className: 'bg-muted text-muted-foreground',
  };
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold tracking-wide',
        kind.className,
        className,
      )}
    >
      {kind.label}
    </span>
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

/** "3 hours ago", "yesterday"; under a minute is "just now". Rendered on the server. */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}
