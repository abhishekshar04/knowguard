import type { ReactNode } from 'react';

import { AppSidebar, TopBar } from '@/components/app-sidebar';
import { requireUser } from '@/lib/session';

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Authoritative check via the API (revocation/suspension apply immediately).
  // Pages must also call requireUser(): layouts don't re-run on client-side navigation.
  const me = await requireUser();
  const shell = {
    user: { name: me.user.name, email: me.user.email },
    organizationName: me.organization.name,
    permissions: me.permissions,
  };

  return (
    <div className="flex min-h-dvh bg-background">
      <a
        href="#content"
        className="sr-only z-50 rounded-lg bg-ink px-4 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <AppSidebar {...shell} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar {...shell} />
        <main id="content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
