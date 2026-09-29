'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

import { ADMIN_NAV, BRAND_ICON as Brand, MAIN_NAV, type NavItem } from './navigation';

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const base = 'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm';

  // Pages from later phases are shown (so the IA is visible) but not linked.
  if (item.phase !== undefined) {
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
        <NavLink key={item.href} item={item} active={pathname === item.href} />
      ))}
    </div>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r bg-sidebar p-3 text-sidebar-foreground md:flex">
      <Link href="/dashboard" className="flex items-center gap-2 px-2.5 pt-1 font-semibold">
        <Brand className="size-5" aria-hidden />
        KnowGuard
      </Link>
      <nav aria-label="Main" className="flex flex-col gap-6">
        <NavSection items={MAIN_NAV} pathname={pathname} />
        <NavSection title="Admin" items={ADMIN_NAV} pathname={pathname} />
      </nav>
    </aside>
  );
}
