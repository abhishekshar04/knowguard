import type { Metadata } from 'next';
import Link from 'next/link';

import { ErrorPanel } from '@/components/errors/error-panel';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Not found' };

/**
 * One page for "does not exist" and "you may not see it": the API answers both with the same
 * 404, and so does the UI, so nothing reveals that a hidden resource exists.
 */
export default function NotFound() {
  return (
    <ErrorPanel
      code="404"
      title="Page not found"
      description="It may have been moved or deleted, or you may not have access to it."
    >
      <Button asChild>
        <Link href="/dashboard">Go to the dashboard</Link>
      </Button>
    </ErrorPanel>
  );
}
