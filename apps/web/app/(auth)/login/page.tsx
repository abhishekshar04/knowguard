import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/auth/login-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentUser, safeRedirectPath } from '@/lib/session';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect('/dashboard');
  const { next } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Access your organization&apos;s knowledge.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm next={next ? safeRedirectPath(next) : undefined} />
      </CardContent>
    </Card>
  );
}
