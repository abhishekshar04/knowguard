'use client';

import { Menu, ShieldCheck, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

const LINKS = [
  { href: '#clearance', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#security', label: 'Security' },
  { href: '#faq', label: 'FAQ' },
];

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';
const action = cn(
  'inline-flex min-h-10 cursor-pointer items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors duration-200',
  focus,
);

/**
 * A floating bar of dark glass hanging from the top edge (flared corners join it to the edge).
 * The glass is plain CSS (.kg-nav-*): glass libraries style themselves with inline style
 * attributes, which the page's Content-Security-Policy does not allow.
 */
export function SiteNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex justify-center px-3 sm:px-6">
      <div className="kg-nav relative w-full max-w-5xl text-white">
        <span aria-hidden className="kg-nav-glass absolute inset-0 rounded-b-[1.375rem]" />
        <span aria-hidden className="kg-nav-flare kg-nav-flare-left" />
        <span aria-hidden className="kg-nav-flare kg-nav-flare-right" />

        <nav aria-label="Main" className="relative flex h-16 items-center justify-between gap-4 pr-2.5 pl-4">
          <Link
            href="/"
            className={cn(
              'font-display flex min-h-10 items-center gap-2.5 rounded-lg text-[1.05rem] font-bold tracking-tight',
              focus,
            )}
          >
            <span className="text-ink flex size-8 items-center justify-center rounded-[0.6rem] bg-white">
              <ShieldCheck className="size-[18px]" aria-hidden />
            </span>
            KnowGuard
          </Link>

          <ul className="hidden items-center gap-0.5 md:flex">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className={cn(
                    'inline-flex min-h-10 items-center rounded-full px-3.5 text-sm text-white/70 transition-colors duration-200 hover:bg-white/10 hover:text-white',
                    focus,
                  )}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-1.5 md:flex">
            {signedIn ? (
              <Link href="/dashboard" className={cn(action, 'text-ink bg-white hover:bg-white/85')}>
                Open KnowGuard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className={cn(action, 'text-white/85 hover:bg-white/10 hover:text-white')}
                >
                  Sign in
                </Link>
                <Link href="/register" className={cn(action, 'text-ink bg-white hover:bg-white/85')}>
                  Create a workspace
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className={cn(
              'inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-white hover:bg-white/10 md:hidden',
              focus,
            )}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </nav>

        {open ? (
          <div id="mobile-menu" className="relative px-4 pb-4 md:hidden">
            <ul className="flex flex-col border-t border-white/10 pt-2">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-12 items-center text-white/85 hover:text-white"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {signedIn ? (
                <Link href="/dashboard" className={cn(action, 'text-ink col-span-2 bg-white')}>
                  Open KnowGuard
                </Link>
              ) : (
                <>
                  <Link href="/login" className={cn(action, 'border border-white/20 text-white')}>
                    Sign in
                  </Link>
                  <Link href="/register" className={cn(action, 'text-ink bg-white')}>
                    Create a workspace
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
