import {
  BarChart3,
  Bot,
  Building2,
  FileText,
  Home,
  KeyRound,
  ScrollText,
  Search,
  Settings,
  Shield,
  UserCog,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Phase in which an unbuilt page ships; such items render as "Soon". */
  comingIn?: number;
  /** Only shown to members holding this permission (UI hint; the API enforces it anyway). */
  requires?: string;
}

export const MAIN_NAV: NavItem[] = [
  { label: 'Home', href: '/dashboard', icon: Home },
  { label: 'Search', href: '/search', icon: Search },
  { label: 'Ask AI', href: '/ask', icon: Bot, comingIn: 8 },
  { label: 'Documents', href: '/documents', icon: FileText },
  { label: 'Teams', href: '/teams', icon: UsersRound },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export const ADMIN_NAV: NavItem[] = [
  { label: 'Users', href: '/admin/users', icon: Users, requires: 'user.create' },
  { label: 'Roles', href: '/admin/roles', icon: UserCog, requires: 'role.update' },
  { label: 'Departments', href: '/admin/departments', icon: Building2, requires: 'department.manage' },
  { label: 'Teams', href: '/admin/teams', icon: UsersRound, requires: 'team.manage' },
  { label: 'Documents', href: '/admin/documents', icon: FileText, requires: 'document.share', comingIn: 5 },
  { label: 'Permissions', href: '/admin/permissions', icon: KeyRound, requires: 'role.update' },
  { label: 'Audit Logs', href: '/admin/audit', icon: ScrollText, requires: 'audit.read', comingIn: 9 },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3, requires: 'audit.read', comingIn: 9 },
];

export function visibleItems(items: NavItem[], permissions: readonly string[]): NavItem[] {
  return items.filter((item) => !item.requires || permissions.includes(item.requires));
}

export const BRAND_ICON = Shield;
