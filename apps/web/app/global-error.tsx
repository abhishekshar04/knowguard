'use client';

import './globals.css';

import { ErrorPanel } from '@/components/errors/error-panel';
import { Button } from '@/components/ui/button';

/** Errors in the root layout itself. Replaces the root layout, so it renders <html> and <body>. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <ErrorPanel
          code="Error"
          title="Something went wrong"
          description={`Please reload the page${error.digest ? ` (reference ${error.digest})` : ''}.`}
        >
          <Button onClick={reset}>Try again</Button>
        </ErrorPanel>
      </body>
    </html>
  );
}
