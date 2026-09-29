'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { type AuthFormState, registerAction } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';

import { FormError, FormField } from './form-field';

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(registerAction, {});

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormError message={state.error} />
      <FormField
        name="name"
        label="Your name"
        autoComplete="name"
        required
        defaultValue={state.values?.name}
        error={state.fieldErrors?.name}
      />
      <FormField
        name="email"
        label="Work email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <FormField
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        minLength={12}
        hint="At least 12 characters. A passphrase works well."
        error={state.fieldErrors?.password}
      />
      <FormField
        name="organizationName"
        label="Organization name"
        autoComplete="organization"
        required
        defaultValue={state.values?.organizationName}
        hint="You'll be the owner of this organization."
        error={state.fieldErrors?.organizationName}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create organization'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
