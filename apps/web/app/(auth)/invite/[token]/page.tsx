import type { InvitationPreview } from '@knowguard/types';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AcceptInvitationForm } from '@/components/auth/accept-invitation-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError, apiRequest } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Join your organization',
  // The URL contains a one-time secret: keep it out of Referer headers and search engines.
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let preview: InvitationPreview | null = null;
  let unavailable = false;
  try {
    preview = await apiRequest<InvitationPreview>(`/invitations/${encodeURIComponent(token)}`);
  } catch (error) {
    unavailable = !(error instanceof ApiError && error.status < 500);
  }

  if (!preview) {
    return (
      <Card data-testid="invitation-invalid">
        <CardHeader>
          <CardTitle className="text-xl">
            {unavailable ? 'Temporarily unavailable' : 'Invitation not valid'}
          </CardTitle>
          <CardDescription>
            {unavailable
              ? 'KnowGuard is temporarily unavailable. Please try this link again shortly.'
              : 'This invitation link is invalid or has expired. Ask your administrator for a new one.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className="text-sm font-medium underline-offset-4 hover:underline">
            Go to sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Join {preview.organizationName}</CardTitle>
        <CardDescription>
          You were invited as <span className="font-medium text-foreground">{preview.email}</span>. Choose a
          password to activate your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AcceptInvitationForm token={token} defaultName={preview.name} />
      </CardContent>
    </Card>
  );
}
