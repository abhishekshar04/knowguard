import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { RegisterForm } from '@/components/auth/register-form';
import { AuthPanel } from '@/components/auth/auth-panel';
import { getCurrentUserIfAvailable } from '@/lib/session';

export const metadata: Metadata = { title: 'Create organization' };

export default async function RegisterPage() {
  if (await getCurrentUserIfAvailable()) redirect('/dashboard');

  return (
    <AuthPanel
      title="Create your organization"
      description="Set up a private, permission-aware knowledge workspace. You become its owner."
    >
      <RegisterForm />
    </AuthPanel>
  );
}
