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
  /** Phase in which the page ships. Items without a phase are live. */
  phase?: number;
}

export const MAIN_NAV: NavItem[] = [
  { label: 'Home', href: '/dashboard', icon: Home },
  { label: 'Search', href: '/search', icon: Search, phase: 7 },
  { label: 'Ask AI', href: '/ask', icon: Bot, phase: 8 },
  { label: 'Documents', href: '/documents', icon: FileText, phase: 5 },
  { label: 'Teams', href: '/teams', icon: UsersRound, phase: 3 },
  { label: 'Settings', href: '/settings', icon: Settings, phase: 2 },
];

export const ADMIN_NAV: NavItem[] = [
  { label: 'Users', href: '/admin/users', icon: Users, phase: 3 },
  { label: 'Roles', href: '/admin/roles', icon: UserCog, phase: 4 },
  { label: 'Departments', href: '/admin/departments', icon: Building2, phase: 3 },
  { label: 'Teams', href: '/admin/teams', icon: UsersRound, phase: 3 },
  { label: 'Documents', href: '/admin/documents', icon: FileText, phase: 5 },
  { label: 'Permissions', href: '/admin/permissions', icon: KeyRound, phase: 4 },
  { label: 'Audit Logs', href: '/admin/audit', icon: ScrollText, phase: 9 },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3, phase: 9 },
];

export const BRAND_ICON = Shield;
