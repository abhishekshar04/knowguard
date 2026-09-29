import type { ReactNode } from 'react';

import { AppSidebar } from '@/components/app-sidebar';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <AppSidebar />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">{children}</div>
      </main>
    </div>
  );
}
