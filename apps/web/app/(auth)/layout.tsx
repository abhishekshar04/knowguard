import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { AuthVisual } from '@/components/landing/auth-visual';
import { PUBLIC_FONTS } from '@/components/landing/fonts';

/**
 * Sign-in, sign-up and invitations: the form on plain white and, on wide screens, a 3D picture of
 * what that form does (see AuthVisual).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${PUBLIC_FONTS} text-ink grid min-h-dvh bg-white [color-scheme:light] lg:grid-cols-2`}>
      <div className="short:py-4 flex min-h-dvh flex-col px-6 py-6 sm:px-10 lg:h-dvh lg:overflow-y-auto lg:px-14">
        <Link
          href="/"
          className="font-display text-ink focus-visible:outline-signal flex min-h-11 w-fit items-center gap-2.5 rounded-lg text-[1.1rem] font-bold tracking-tight focus-visible:outline-2"
        >
          <span className="bg-ink flex size-8 items-center justify-center rounded-lg text-white">
            <ShieldCheck className="size-[18px]" aria-hidden />
          </span>
          KnowGuard
        </Link>
        <main className="short:py-4 flex flex-1 items-center py-12">
          <div className="mx-auto w-full max-w-sm">{children}</div>
        </main>
        <p className="text-ink-soft text-xs">Every account sees only the documents it is cleared to read.</p>
      </div>

      <aside
        aria-hidden
        className="border-rule bg-paper relative hidden overflow-hidden border-l lg:sticky lg:top-0 lg:block lg:h-dvh"
      >
        <div className="kg-grid absolute inset-0" />
        <AuthVisual />
      </aside>
    </div>
  );
}
