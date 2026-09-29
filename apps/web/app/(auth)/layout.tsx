import type { ReactNode } from 'react';

import { BRAND_ICON as Brand } from '@/components/navigation';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <div className="mb-6 flex items-center gap-2 text-lg font-semibold">
        <Brand className="size-6" aria-hidden />
        KnowGuard
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
