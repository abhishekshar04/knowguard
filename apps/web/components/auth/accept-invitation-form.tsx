'use client';

import { useActionState } from 'react';

import { acceptInvitationAction, type AuthFormState } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';

import { FormError, FormField } from './form-field';

export function AcceptInvitationForm({ token, defaultName }: { token: string; defaultName: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(acceptInvitationAction, {});

  return (
    <form action={action} className="short:gap-3 shorter:gap-2.5 flex flex-col gap-4" noValidate>
      <FormError message={state.error} />
      <input type="hidden" name="token" value={token} />
      <FormField
        name="name"
        label="Your name"
        autoComplete="name"
        defaultValue={state.values?.name ?? defaultName}
        error={state.fieldErrors?.name}
      />
      <FormField
        name="password"
        label="Choose a password"
        type="password"
        autoComplete="new-password"
        required
        minLength={12}
        hint="At least 12 characters. A passphrase works well."
        error={state.fieldErrors?.password}
      />
      <Button
        type="submit"
        disabled={pending}
        className="bg-ink hover:bg-ink/85 short:h-10 mt-2 h-11 rounded-full"
      >
        {pending ? 'Joining…' : 'Join organization'}
      </Button>
    </form>
  );
}
