import type { InvitationPreview } from '@knowguard/types';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AcceptInvitationForm } from '@/components/auth/accept-invitation-form';
import { AuthPanel } from '@/components/auth/auth-panel';
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
      <AuthPanel
        data-testid="invitation-invalid"
        title={unavailable ? 'Temporarily unavailable' : 'Invitation not valid'}
        description={
          unavailable
            ? 'KnowGuard is temporarily unavailable. Please try this link again shortly.'
            : 'This invitation link is invalid or has expired. Ask your administrator for a new one.'
        }
      >
        <Link
          href="/login"
          className="text-ink text-sm font-medium underline decoration-rule underline-offset-4 hover:decoration-ink"
        >
          Go to sign in
        </Link>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel
      data-organization={preview.organizationName}
      title={<>Join {preview.organizationName}</>}
      description={
        <>
          You were invited as <span className="text-ink font-medium">{preview.email}</span>. Choose a password
          to activate your account.
        </>
      }
    >
      <AcceptInvitationForm token={token} defaultName={preview.name} />
    </AuthPanel>
  );
}
