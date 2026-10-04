'use client';

import { Menu, Search, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { cn, initials } from '@/lib/utils';

import { ADMIN_NAV, BRAND_ICON as Brand, MAIN_NAV, type NavItem, visibleItems } from './navigation';
import { SignOutButton } from './sign-out-button';

/*
 * The signed-in shell: a sidebar on wide screens, a top bar everywhere (quick search and Ask AI),
 * and on smaller screens the same navigation in a slide-in drawer (a native <dialog>, so focus,
 * Escape and the backdrop work without a library).
 */

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

interface ShellProps {
  user: { name: string; email: string };
  organizationName: string;
  permissions: readonly string[];
}

function BrandMark() {
  return (
    <span className="flex items-center gap-2.5 font-display text-[1.05rem] font-bold tracking-tight">
      <span className="flex size-8 items-center justify-center rounded-[0.6rem] bg-ink text-white">
        <Brand className="size-[18px]" aria-hidden />
      </span>
      KnowGuard
    </span>
  );
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  const base =
    'group relative flex min-h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150 pointer-coarse:min-h-11';

  // Pages from later phases are shown (so the IA is visible) but not linked.
  if (item.comingIn !== undefined) {
    return (
      <span className={cn(base, 'cursor-not-allowed text-muted-foreground/70')} aria-disabled="true">
        <Icon className="size-4" aria-hidden />
        <span className="flex-1">{item.label}</span>
        <span className="text-[10px] tracking-wide uppercase">Soon</span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        base,
        'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30',
        active
          ? 'bg-ink/[0.06] font-medium text-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {active ? (
        <span aria-hidden className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-signal" />
      ) : null}
      <Icon
        className={cn('size-4', active ? 'text-signal' : 'text-muted-foreground group-hover:text-foreground')}
        aria-hidden
      />
      {item.label}
    </Link>
  );
}

function Navigation({
  permissions,
  label,
  onNavigate,
}: {
  permissions: readonly string[];
  label: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const mainItems = visibleItems(MAIN_NAV, permissions);
  const adminItems = visibleItems(ADMIN_NAV, permissions);
  return (
    <nav aria-label={label} className="flex flex-1 flex-col gap-6 overflow-y-auto px-3">
      <div className="flex flex-col gap-0.5">
        {mainItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
            onNavigate={onNavigate}
          />
        ))}
      </div>
      {adminItems.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Admin
          </p>
          {adminItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
    </nav>
  );
}

function Workspace({ organizationName, testId }: { organizationName: string; testId?: string }) {
  return (
    <div className="mx-3 flex items-center gap-3 rounded-xl border bg-background/60 px-3 py-2.5">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-signal-soft text-sm font-semibold text-signal"
      >
        {initials(organizationName)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium" data-testid={testId}>
          {organizationName}
        </span>
        <span className="block text-xs text-muted-foreground">Workspace</span>
      </span>
    </div>
  );
}

function Account({ user }: { user: ShellProps['user'] }) {
  return (
    <div className="flex flex-col gap-1 border-t p-3">
      <div className="flex items-center gap-3 px-1 py-1">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white"
        >
          {initials(user.name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        </span>
      </div>
      <SignOutButton className="w-full justify-start text-muted-foreground hover:text-foreground" />
    </div>
  );
}

export function AppSidebar({ user, organizationName, permissions }: ShellProps) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-5 border-r bg-sidebar pt-4 text-sidebar-foreground lg:flex">
      <Link
        href="/dashboard"
        className="mx-3 rounded-lg px-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
      >
        <BrandMark />
      </Link>
      <Workspace organizationName={organizationName} testId="sidebar-organization" />
      <Navigation permissions={permissions} label="Main" />
      <Account user={user} />
    </aside>
  );
}

/** Quick search in the top bar: opens the search page with the query already run. */
function QuickSearch() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  // "/" focuses the search from anywhere (except while typing in a field).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest('input, textarea, select, [contenteditable="true"]');
      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <form
      role="search"
      className="relative hidden w-full max-w-md sm:block"
      onSubmit={(event) => {
        event.preventDefault();
        const query = input.current?.value.trim() ?? '';
        if (query) router.push(`/search?q=${encodeURIComponent(query)}`);
      }}
    >
      <label htmlFor="quick-search" className="sr-only">
        Quick search
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        ref={input}
        id="quick-search"
        type="search"
        maxLength={500}
        placeholder="Search your documents…"
        className="h-9 w-full rounded-lg border border-input bg-card pr-10 pl-9 text-sm shadow-xs outline-none placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
      />
      <kbd
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border bg-background px-1.5 font-sans text-[11px] text-muted-foreground md:block"
      >
        /
      </kbd>
    </form>
  );
}

export function TopBar({ user, organizationName, permissions }: ShellProps) {
  const pathname = usePathname();
  const drawer = useRef<HTMLDialogElement>(null);
  const canAsk = permissions.includes('ai.query');
  const close = () => drawer.current?.close();

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => drawer.current?.showModal()}
          className="-ml-1.5 inline-flex size-10 cursor-pointer items-center justify-center rounded-lg hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/30 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <Link
          href="/dashboard"
          className="rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 lg:hidden"
        >
          <BrandMark />
        </Link>

        <div className="flex flex-1 justify-end lg:justify-start">
          {pathname.startsWith('/search') ? null : <QuickSearch />}
        </div>

        {canAsk && !pathname.startsWith('/ask') ? (
          <Link
            href="/ask"
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-ink px-3.5 text-sm font-medium text-white shadow-xs transition-colors hover:bg-ink/85 focus-visible:ring-[3px] focus-visible:ring-ring/30 pointer-coarse:h-10"
          >
            <Sparkles className="size-4" aria-hidden />
            <span className="hidden sm:inline">Ask AI</span>
            <span className="sr-only sm:hidden">Ask AI</span>
          </Link>
        ) : null}
      </div>

      <dialog
        ref={drawer}
        aria-label="Navigation"
        className="kg-drawer m-0 h-dvh max-h-dvh w-[min(20rem,86vw)] max-w-none bg-sidebar p-0 text-sidebar-foreground"
        onClick={(event) => {
          if (event.target === drawer.current) close(); // a click on the backdrop
        }}
      >
        <div className="flex h-full flex-col gap-5 pt-3">
          <div className="flex items-center justify-between px-4">
            <BrandMark />
            <button
              type="button"
              onClick={close}
              className="inline-flex size-10 cursor-pointer items-center justify-center rounded-lg hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/30"
              aria-label="Close navigation"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <Workspace organizationName={organizationName} />
          <Navigation permissions={permissions} label="Main (menu)" onNavigate={close} />
          <Account user={user} />
        </div>
      </dialog>
    </header>
  );
}
