'use client';

/**
 * Virtualized, infinite-scrolling results grid.
 *
 *  - RTK Query `infiniteQuery` fetches cursor pages and caches them per filter set.
 *  - `@tanstack/react-virtual` renders only the visible rows, so the DOM node count
 *    stays constant regardless of how many results have loaded — this keeps INP low
 *    on long lists (the alternative, rendering 1000+ rows, tanks interactivity).
 *  - An IntersectionObserver-free approach: we fetch the next page when the last
 *    virtual item nears the end of the list.
 */
import { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAppSelector } from '@/store/hooks';
import { useSearchEntitiesInfiniteQuery } from '@/store/api';
import { EntityCard } from '@/features/trending/EntityCard';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/primitives';
import type { EntitySummary } from '@/schemas';

const ROW = 80; // px — must match rendered row height to keep scroll math stable

export function RadarGrid() {
  const { q, language, type } = useAppSelector((s) => s.radar);
  const parentRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, isFetching, hasNextPage, fetchNextPage } =
    useSearchEntitiesInfiniteQuery({
      q: q || undefined,
      lang: language || undefined,
      type: type === 'all' ? undefined : type,
      limit: 20,
    });

  const items: EntitySummary[] = data?.pages.flatMap((p) => p.data) ?? [];

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW,
    overscan: 8,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastIndex = virtualItems.at(-1)?.index ?? 0;

  // Prefetch the next page as the user nears the bottom.
  useEffect(() => {
    if (lastIndex >= items.length - 5 && hasNextPage && !isFetching) {
      void fetchNextPage();
    }
  }, [lastIndex, items.length, hasNextPage, isFetching, fetchNextPage]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] w-full" />
        ))}
      </div>
    );
  }
  if (isError) {
    return <ErrorState title="Couldn't load results" hint="Please retry in a moment." />;
  }
  if (items.length === 0) {
    return <EmptyState title="No matches" hint="Adjust your search or filters." />;
  }

  return (
    <div
      ref={parentRef}
      className="h-[70vh] overflow-auto rounded-xl"
    >
      <div style={{ height: virtualizer.getTotalSize() + 16, position: 'relative' }}>
        {virtualItems.map((vi) => (
          <div
            key={items[vi.index].id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: ROW,
              transform: `translateY(${vi.start}px)`,
              paddingBottom: 8,
            }}
          >
            <EntityCard entity={items[vi.index]} />
          </div>
        ))}
      </div>
      {isFetching && <p className="py-3 text-center text-xs text-muted">Loading more…</p>}
    </div>
  );
}
