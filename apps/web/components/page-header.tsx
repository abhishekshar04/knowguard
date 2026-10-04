import { type LucideIcon, ShieldOff } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card, CardContent } from '@/components/ui/card';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex max-w-2xl flex-col gap-1.5">
        <h1 className="font-display text-[1.75rem] leading-[1.1] font-bold tracking-[-0.03em] sm:text-[2rem]">
          {title}
        </h1>
        {description ? (
          <p className="text-[15px] leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

/** Shown when the signed-in user lacks the permission for a page. The API enforces it too. */
export function AccessDenied({ what }: { what: string }) {
  return (
    <Card data-testid="access-denied" className="mx-auto mt-10 max-w-md items-center px-6 py-10 text-center">
      <CardContent className="flex flex-col items-center gap-3 px-0">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-muted">
          <ShieldOff className="size-5 text-muted-foreground" aria-hidden />
        </span>
        <p className="font-display text-lg font-semibold tracking-tight">
          You don&apos;t have access to {what}.
        </p>
        <p className="text-sm text-muted-foreground">
          Ask an administrator of your organization if you need it.
        </p>
      </CardContent>
    </Card>
  );
}

/** A friendly empty state: an icon, one line on what belongs here, and the next step. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card/60 px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-muted">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
      </span>
      <p className="font-medium">{title}</p>
      {children ? <div className="max-w-sm text-sm text-muted-foreground">{children}</div> : null}
      {action}
    </div>
  );
}
