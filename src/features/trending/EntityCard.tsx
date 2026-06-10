/**
 * EntityCard — the shared presentation of a ranked entity. Server-component-safe; the
 * only interactive bit (WatchButton) is its own client island, so cards in a list ship
 * almost no client JS.
 */
import Link from 'next/link';
import { Badge } from '@/components/ui/primitives';
import { MomentumBadge } from '@/components/MomentumBadge';
import { WatchButton } from '@/features/watchlist/WatchButton';
import { compact, signedCompact, timeAgo } from '@/lib/format';
import type { EntitySummary } from '@/schemas';

const TYPE_LABEL: Record<EntitySummary['type'], string> = {
  repo: 'Repo',
  topic: 'Topic',
  hn_story: 'HN',
};

export function EntityCard({ entity, rank }: { entity: EntitySummary; rank?: number }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-card px-3 py-3 transition hover:border-accent/40 sm:gap-4 sm:px-4">
      {rank != null && (
        <span className="w-6 shrink-0 text-center font-mono text-sm text-muted">{rank}</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/entity/${entity.id}`}
            className="truncate font-medium text-text hover:text-accent"
          >
            {entity.name}
          </Link>
          <Badge tone="muted">{TYPE_LABEL[entity.type]}</Badge>
          {entity.language && <Badge tone="accent">{entity.language}</Badge>}
        </div>
        {entity.description && (
          <p className="mt-0.5 truncate text-sm text-muted">{entity.description}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 font-mono text-xs text-muted">
          <span>★ {compact(entity.stars)}</span>
          {entity.starsDelta != null && entity.starsDelta !== 0 && (
            <span className="text-accent-2">{signedCompact(entity.starsDelta)} stars</span>
          )}
          {entity.hnPoints ? <span>▲ {compact(entity.hnPoints)} HN</span> : null}
          <span>· {timeAgo(entity.capturedAt)}</span>
        </div>
      </div>
      <div className="hidden sm:block">
        <MomentumBadge score={entity.momentumScore} />
      </div>
      <WatchButton entityId={entity.id} />
    </div>
  );
}
