import type { Metadata } from 'next';
import { connection } from 'next/server';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: { default: 'KnowGuard', template: '%s · KnowGuard' },
  description: 'Permission-aware enterprise knowledge platform',
};

/**
 * Every page renders per request: the Content-Security-Policy nonce set in proxy.ts can only be
 * applied to dynamically rendered pages (statically prerendered pages would have their scripts
 * blocked). All pages are per-user anyway.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection();
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
