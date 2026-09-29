import { LogOut } from 'lucide-react';

import { logoutAction } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';

/** A form (not a link) so sign-out is a POST: prefetching or crawlers can't log users out. */
export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="ghost" size="sm" className={className}>
        <LogOut aria-hidden />
        Sign out
      </Button>
    </form>
  );
}
