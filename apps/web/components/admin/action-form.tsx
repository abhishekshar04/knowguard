'use client';

import { Check, Copy } from 'lucide-react';
import { type ReactNode, useActionState, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { ActionResult } from '@/lib/action-result';
import { cn } from '@/lib/utils';

type Action = (prev: ActionResult, form: FormData) => Promise<ActionResult>;

interface ActionFormProps {
  action: Action;
  /** Hidden fields (IDs). Untrusted by the server — the API scopes them to the caller's tenant. */
  hidden?: Record<string, string>;
  submitLabel: string;
  pendingLabel?: string;
  variant?: 'default' | 'outline' | 'ghost';
  children?: ReactNode;
  className?: string;
  /** Inline forms (a row of controls) vs stacked forms. */
  inline?: boolean;
  /** Hide the success message (e.g. when the list itself visibly changes). */
  quiet?: boolean;
}

/** A small server-action form with pending state and inline error/success feedback. */
export function ActionForm({
  action,
  hidden,
  submitLabel,
  pendingLabel,
  variant = 'default',
  children,
  className,
  inline = false,
  quiet = false,
}: ActionFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(action, {});
  return (
    <form action={formAction} className={cn('flex flex-col gap-2', className)}>
      {hidden &&
        Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      <div className={cn(inline ? 'flex flex-wrap items-end gap-2' : 'flex flex-col gap-3')}>
        {children}
        <Button
          type="submit"
          size="sm"
          variant={variant}
          disabled={pending}
          className={inline ? '' : 'self-start'}
        >
          {pending ? (pendingLabel ?? `${submitLabel}…`) : submitLabel}
        </Button>
      </div>
      {state.error ? (
        <p role="alert" data-testid="action-error" className="text-xs text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.ok && state.message && !quiet ? (
        <p role="status" className="text-xs text-success">
          {state.message}
        </p>
      ) : null}
      {state.inviteUrl ? <CopyField value={state.inviteUrl} /> : null}
    </form>
  );
}

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={value}
        aria-label="Invitation link"
        data-testid="invite-url"
        onFocus={(event) => event.currentTarget.select()}
        className="h-8 min-w-0 flex-1 rounded-md border bg-muted px-2 font-mono text-xs"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        }}
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
