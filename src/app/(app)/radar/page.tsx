/**
 * /radar — search + filter with infinite scroll.
 *
 * The page is an SSR shell (heading + controls render server-side for first paint and
 * SEO); the interactive grid is a client island that fetches via RTK Query. We force
 * dynamic because the experience is inherently interactive and per-session.
 */
import type { Metadata } from 'next';
import { RadarSearchBar } from '@/features/radar/RadarSearchBar';
import { RadarGrid } from '@/features/radar/RadarGrid';

export const metadata: Metadata = { title: 'Radar' };
export const dynamic = 'force-dynamic';

export default function RadarPage() {
  return (
    <div className="pb-8">
      <h1 className="mb-1 text-2xl font-bold">Tech Radar</h1>
      <p className="mb-5 text-sm text-muted">
        Search and filter the full tracked set. Infinite scroll over keyset-paginated,
        virtualized results.
      </p>
      <RadarSearchBar />
      <RadarGrid />
    </div>
  );
}
