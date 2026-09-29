import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { RegisterForm } from '@/components/auth/register-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentUserIfAvailable } from '@/lib/session';

export const metadata: Metadata = { title: 'Create organization' };

export default async function RegisterPage() {
  if (await getCurrentUserIfAvailable()) redirect('/dashboard');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create your organization</CardTitle>
        <CardDescription>Set up a private, permission-aware knowledge workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm />
      </CardContent>
    </Card>
  );
}
