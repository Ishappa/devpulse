/**
 * /trending and /trending/[lang] — ISR.
 *
 * Identical for every user and tolerant of 15-min staleness, so it's the ideal ISR
 * candidate: one edge-cached HTML doc serves everyone; the DB is hit ~once per
 * revalidation window, not per request. `generateStaticParams` pre-builds the top
 * languages at build time; other languages are generated on-demand and then cached.
 */
import type { Metadata } from 'next';
import { getRanked } from '@/lib/queries';
import { EntityCard } from '@/features/trending/EntityCard';
import { EmptyState } from '@/components/ui/primitives';
import { LanguageFilter } from '@/features/trending/LanguageFilter';
import { LANGUAGE_SLUGS, TRACKED_LANGUAGES } from '@/config/tech';
import type { EntitySummary } from '@/schemas';

export const revalidate = 900; // 15 min — matches the ingest cadence
export const dynamicParams = true;

const TOP_LANGUAGES = LANGUAGE_SLUGS;

export function generateStaticParams() {
  return [{ lang: [] as string[] }, ...TOP_LANGUAGES.map((l) => ({ lang: [l] }))];
}

export function generateMetadata({ params }: { params: { lang?: string[] } }): Metadata {
  const slug = params.lang?.[0];
  const lang = TRACKED_LANGUAGES.find((l) => l.toLowerCase() === slug?.toLowerCase()) ?? slug;
  return { title: lang ? `Trending in ${lang}` : 'Trending' };
}

export default async function TrendingPage({ params }: { params: { lang?: string[] } }) {
  const slug = params.lang?.[0];
  // URL slugs are lowercase ("typescript") but DB stores proper case ("TypeScript").
  const language = TRACKED_LANGUAGES.find((l) => l.toLowerCase() === slug?.toLowerCase()) ?? slug;

  let rows: EntitySummary[] = [];
  let failed = false;
  try {
    rows = await getRanked({ limit: 30, language });
  } catch {
    // Build-time prerender without a DB, or a transient outage: render the empty
    // state rather than failing the page. Real data fills in on revalidation.
    failed = true;
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Trending{language ? <span className="text-accent"> · {language}</span> : null}
          </h1>
          <p className="text-sm text-muted">
            Ranked by momentum — star velocity and Hacker News discussion, time-decayed.
          </p>
        </div>
        <LanguageFilter languages={TOP_LANGUAGES} active={language ?? null} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={failed ? 'No data yet' : 'Nothing trending here yet'}
          hint={
            failed
              ? 'The ingest pipeline has not run, or the database is unreachable. Trigger /api/cron/ingest.'
              : 'Try another language, or check back after the next ingest cycle.'
          }
        />
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((e, i) => (
            <li key={e.id}>
              <EntityCard entity={e} rank={i + 1} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
