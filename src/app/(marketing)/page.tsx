/**
 * Landing page — SSG. Pure static content with no per-user data, so it's built once and
 * served from the CDN: instant LCP, no JS needed beyond the framework runtime.
 */
import Link from 'next/link';

export default function Landing() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-20 text-center">
      <span className="inline-block rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-mono text-xs text-accent">
        GitHub × Hacker News intelligence
      </span>
      <h1 className="mt-6 text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
        See what developers are building <span className="text-accent">before</span> it goes
        mainstream.
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-balance text-lg text-muted">
        DevPulse aggregates GitHub and Hacker News in real time and computes a unified
        momentum score — star velocity and discussion volume, time-decayed — so you can
        spot rising technologies early.
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <Link
          href="/trending"
          className="rounded-lg bg-accent px-5 py-2.5 font-medium text-bg transition hover:opacity-90"
        >
          View trending
        </Link>
        <Link
          href="/radar"
          className="rounded-lg border border-border px-5 py-2.5 font-medium text-text transition hover:border-accent/50"
        >
          Explore the radar
        </Link>
      </div>

      <dl className="mt-20 grid grid-cols-1 gap-4 text-left sm:grid-cols-3">
        {[
          {
            t: 'Momentum, not vanity',
            d: 'Stars are lagging. We score velocity with time-decay so you see acceleration, not totals.',
          },
          {
            t: 'Two sources, one signal',
            d: 'Repos rising on GitHub and discussed on HN get a corroboration boost — independent confirmation.',
          },
          {
            t: 'Always fresh',
            d: 'A background pipeline ingests every 15 minutes; reads are served from cache, sub-second.',
          },
        ].map((f) => (
          <div key={f.t} className="rounded-xl border border-border bg-bg-card p-5">
            <dt className="font-semibold text-text">{f.t}</dt>
            <dd className="mt-1 text-sm text-muted">{f.d}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
