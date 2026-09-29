import { ShieldOff } from 'lucide-react';
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
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </header>
  );
}

/** Shown when the signed-in user lacks the permission for a page. The API enforces it too. */
export function AccessDenied({ what }: { what: string }) {
  return (
    <Card data-testid="access-denied">
      <CardContent className="flex items-start gap-3 text-sm">
        <ShieldOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-medium">You don&apos;t have access to {what}.</p>
          <p className="text-muted-foreground">Ask an administrator of your organization if you need it.</p>
        </div>
      </CardContent>
    </Card>
  );
}
