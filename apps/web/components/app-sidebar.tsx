'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

import { ADMIN_NAV, BRAND_ICON as Brand, MAIN_NAV, type NavItem, visibleItems } from './navigation';
import { SignOutButton } from './sign-out-button';

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const base = 'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm';

  // Pages from later phases are shown (so the IA is visible) but not linked.
  if (item.comingIn !== undefined) {
    return (
      <span className={cn(base, 'cursor-not-allowed text-muted-foreground/70')} aria-disabled="true">
        <Icon className="size-4" aria-hidden />
        <span className="flex-1">{item.label}</span>
        <span className="text-[10px] uppercase tracking-wide">Soon</span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(base, active ? 'bg-accent font-medium text-accent-foreground' : 'hover:bg-accent/60')}
    >
      <Icon className="size-4" aria-hidden />
      {item.label}
    </Link>
  );
}

function NavSection({ title, items, pathname }: { title?: string; items: NavItem[]; pathname: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      {title && (
        <p className="px-2.5 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
      )}
      {items.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
      ))}
    </div>
  );
}

interface AppSidebarProps {
  user: { name: string; email: string };
  organizationName: string;
  permissions: readonly string[];
}

export function AppSidebar({ user, organizationName, permissions }: AppSidebarProps) {
  const pathname = usePathname();
  const adminItems = visibleItems(ADMIN_NAV, permissions);
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r bg-sidebar p-3 text-sidebar-foreground md:flex">
      <Link href="/dashboard" className="flex flex-col gap-0.5 px-2.5 pt-1">
        <span className="flex items-center gap-2 font-semibold">
          <Brand className="size-5" aria-hidden />
          KnowGuard
        </span>
        <span className="truncate text-xs text-muted-foreground" data-testid="sidebar-organization">
          {organizationName}
        </span>
      </Link>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-6 overflow-y-auto">
        <NavSection items={MAIN_NAV} pathname={pathname} />
        {adminItems.length > 0 ? <NavSection title="Admin" items={adminItems} pathname={pathname} /> : null}
      </nav>
      <div className="flex flex-col gap-2 border-t pt-3">
        <div className="min-w-0 px-2.5">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <SignOutButton className="justify-start" />
      </div>
    </aside>
  );
}

/** Top bar for small screens, where the sidebar is hidden: org name, live links, sign out. */
export function MobileHeader({
  organizationName,
  permissions,
}: {
  organizationName: string;
  permissions: readonly string[];
}) {
  const pathname = usePathname();
  const links = [...MAIN_NAV, ...visibleItems(ADMIN_NAV, permissions)].filter(
    (item) => item.comingIn === undefined,
  );
  return (
    <header className="border-b md:hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        <span className="flex min-w-0 items-center gap-2 font-semibold">
          <Brand className="size-5 shrink-0" aria-hidden />
          <span className="truncate">{organizationName}</span>
        </span>
        <SignOutButton />
      </div>
      <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-2">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(pathname, item.href) ? 'page' : undefined}
            className={cn(
              'shrink-0 rounded-md px-2.5 py-1 text-sm',
              isActive(pathname, item.href) ? 'bg-accent font-medium' : 'text-muted-foreground',
            )}
          >
            {item.href.startsWith('/admin/') ? `Admin · ${item.label}` : item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
