import type { Metadata } from 'next';

import { Experience } from '@/components/landing/experience';
import { SiteNav } from '@/components/landing/site-nav';
import { AfterStory, Chapters, Hero } from '@/components/landing/story';
import { getSessionToken } from '@/lib/session';

export const metadata: Metadata = {
  title: { absolute: 'KnowGuard — Knowledge, on a need-to-know basis' },
  description:
    'KnowGuard answers your team’s questions from your company’s own documents, with sources for every claim, and only ever reads the ones each person is cleared to see.',
};

export default async function LandingPage() {
  // Only decides which buttons to show; every app page still verifies the session with the API.
  const signedIn = Boolean(await getSessionToken());
  return (
    <Experience header={<SiteNav signedIn={signedIn} />}>
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-white px-4 py-2 text-slate-950 focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        Skip to content
      </a>
      <main id="main">
        <Hero signedIn={signedIn} />
        <Chapters />
        <AfterStory signedIn={signedIn} />
      </main>
    </Experience>
  );
}
