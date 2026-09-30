import type { DocumentStatusValue, DocumentVisibilityValue } from '@knowguard/types';

import { Badge } from '@/components/ui/badge';

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
  { label: string; variant: 'success' | 'secondary' | 'destructive' | 'outline' }
> = {
  UPLOADING: { label: 'uploading', variant: 'outline' },
  PROCESSING: { label: 'processing', variant: 'secondary' },
  INDEXING: { label: 'indexing', variant: 'secondary' },
  READY: { label: 'ready', variant: 'success' },
  FAILED: { label: 'failed', variant: 'destructive' },
  ARCHIVED: { label: 'archived', variant: 'outline' },
};

export function StatusBadge({ status }: { status: DocumentStatusValue }) {
  return (
    <Badge variant={STATUS[status].variant} data-testid="document-status">
      {STATUS[status].label}
    </Badge>
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
