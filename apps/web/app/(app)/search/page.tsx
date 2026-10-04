import type { Metadata } from 'next';

import { AccessDenied, PageHeader } from '@/components/page-header';
import { SearchView } from '@/components/search/search-view';
import { can } from '@/lib/permissions';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Search' };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireUser();
  if (!can(me, 'document.read')) return <AccessDenied what="search" />;
  const { q } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Search"
        description="Keyword and meaning-based search across documents you are allowed to read. Nothing else is ever searched."
      />
      <SearchView initialQuery={typeof q === 'string' ? q.slice(0, 500) : ''} />
    </div>
  );
}
