/**
 * /entity/[id] — ISR with on-demand revalidation.
 *
 * Entity detail is mostly stable, so it's cached (revalidate 900). The ingest worker
 * calls revalidatePath('/entity/:id') when a fresh snapshot lands, so a hot entity
 * updates immediately without time-based waste. We never pre-build these (dynamicParams)
 * — they're generated on first visit and then cached at the edge.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getEntityWithSeries } from '@/lib/queries';
import { Sparkline } from '@/components/Sparkline';
import { MomentumBadge } from '@/components/MomentumBadge';
import { Badge, Card } from '@/components/ui/primitives';
import { WatchButton } from '@/features/watchlist/WatchButton';
import { compact, signedCompact, timeAgo } from '@/lib/format';

export const revalidate = 900;

async function load(id: number) {
  try {
    return await getEntityWithSeries(id);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const data = await load(Number(params.id));
  return { title: data?.entity.name ?? 'Entity' };
}

export default async function EntityPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const data = await load(id);
  if (!data) notFound();
  const { entity, series } = data;
  const momentumSeries = series.map((s) => s.momentumScore);

  return (
    <article className="mx-auto max-w-3xl">
      <Link href="/trending" className="text-sm text-muted hover:text-text">
        ← Back to trending
      </Link>

      <header className="mt-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{entity.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="muted">{entity.type}</Badge>
            {entity.language && <Badge tone="accent">{entity.language}</Badge>}
            <span className="text-xs text-muted">updated {timeAgo(entity.capturedAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <MomentumBadge score={entity.momentumScore} />
          <WatchButton entityId={entity.id} />
        </div>
      </header>

      {entity.description && <p className="mt-4 text-muted">{entity.description}</p>}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Stars" value={compact(entity.stars)} />
        <Stat label="Stars Δ" value={signedCompact(entity.starsDelta)} accent />
        <Stat label="HN points" value={compact(entity.hnPoints)} />
        <Stat label="HN comments" value={compact(entity.hnComments)} />
      </div>

      <Card className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted">Momentum over time</h2>
          <span className="font-mono text-xs text-muted">{series.length} snapshots</span>
        </div>
        {momentumSeries.length >= 2 ? (
          <Sparkline values={momentumSeries} width={640} height={120} className="w-full" />
        ) : (
          <p className="py-8 text-center text-sm text-muted">
            Not enough history yet — momentum needs at least two ingest cycles.
          </p>
        )}
      </Card>

      {entity.url && (
        <a
          href={entity.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-block rounded-md border border-border px-4 py-2 text-sm text-accent hover:border-accent/50"
        >
          Open source ↗
        </a>
      )}
    </article>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-bg-card px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className={`font-mono text-lg ${accent ? 'text-accent-2' : 'text-text'}`}>{value}</div>
    </div>
  );
}
