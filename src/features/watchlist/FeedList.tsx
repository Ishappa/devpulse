'use client';

import { useGetFeedQuery } from '@/store/api';
import { EntityCard } from '@/features/trending/EntityCard';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/primitives';

export function FeedList() {
  const { data, isLoading, isError } = useGetFeedQuery();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] w-full" />
        ))}
      </div>
    );
  }
  if (isError) return <ErrorState title="Couldn't load your feed" />;
  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="Your feed is empty"
        hint="Watch repos and topics from Trending or Radar and they'll show up here, ranked by momentum."
      />
    );
  }

  return (
    <ol className="flex flex-col gap-2">
      {data.map((e, i) => (
        <li key={e.id}>
          <EntityCard entity={e} rank={i + 1} />
        </li>
      ))}
    </ol>
  );
}
