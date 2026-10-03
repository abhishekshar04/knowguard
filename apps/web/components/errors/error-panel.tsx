import type { ReactNode } from 'react';

/**
 * Shared body of the not-found and error pages. Styled with classes only: the framework's
 * default pages use inline <style> tags, which the Content-Security-Policy blocks.
 */
export function ErrorPanel({
  code,
  title,
  description,
  children,
}: {
  code: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-4 py-16" data-testid="error-panel">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <p className="text-sm font-medium tabular-nums text-muted-foreground">{code}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        {children ? <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div> : null}
      </div>
    </div>
  );
}
