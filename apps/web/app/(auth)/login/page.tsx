import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/auth/login-form';
import { AuthPanel } from '@/components/auth/auth-panel';
import { getCurrentUserIfAvailable, safeRedirectPath } from '@/lib/session';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUserIfAvailable()) redirect('/dashboard');
  const { next } = await searchParams;

  return (
    <AuthPanel title="Sign in" description="Access your organization’s knowledge.">
      <LoginForm next={next ? safeRedirectPath(next) : undefined} />
    </AuthPanel>
  );
}
