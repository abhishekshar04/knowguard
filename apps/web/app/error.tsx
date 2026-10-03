'use client';

import { ErrorPanel } from '@/components/errors/error-panel';
import { Button } from '@/components/ui/button';

/**
 * Unexpected errors. Shows no details: server error messages are replaced by Next.js in
 * production, and only the opaque digest is shown so support can find the server log entry.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorPanel
      code="Error"
      title="Something went wrong"
      description={`Please try again. If it keeps happening, contact your administrator${
        error.digest ? ` and mention reference ${error.digest}` : ''
      }.`}
    >
      <Button onClick={reset}>Try again</Button>
    </ErrorPanel>
  );
}
