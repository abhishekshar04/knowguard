import type { ReactNode } from 'react';

import { AppSidebar, MobileHeader } from '@/components/app-sidebar';
import { requireUser } from '@/lib/session';

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Authoritative check via the API (revocation/suspension apply immediately).
  // Pages must also call requireUser(): layouts don't re-run on client-side navigation.
  const me = await requireUser();

  return (
    <div className="flex min-h-dvh">
      <AppSidebar
        user={{ name: me.user.name, email: me.user.email }}
        organizationName={me.organization.name}
        permissions={me.permissions}
      />
      <main className="min-w-0 flex-1">
        <MobileHeader organizationName={me.organization.name} permissions={me.permissions} />
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">{children}</div>
      </main>
    </div>
  );
}
