'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { type AuthFormState, loginAction } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';

import { FormError, FormField } from './form-field';

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(loginAction, {});

  return (
    <form action={action} className="short:gap-3 shorter:gap-2.5 flex flex-col gap-4" noValidate>
      <FormError message={state.error} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormField
        name="email"
        label="Email"
        type="email"
        autoComplete="username"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <FormField
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />
      <Button
        type="submit"
        disabled={pending}
        className="bg-ink hover:bg-ink/85 short:h-10 mt-2 h-11 rounded-full"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New to KnowGuard?{' '}
        <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
          Create an organization
        </Link>
      </p>
    </form>
  );
}
