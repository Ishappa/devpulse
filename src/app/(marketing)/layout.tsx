/**
 * Marketing layout — intentionally minimal. No Redux/session Providers, so the landing
 * page ships almost no client JS and scores well on Lighthouse. Just a static header.
 */
import Link from 'next/link';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-extrabold tracking-tight">
            Dev<span className="text-accent">Pulse</span>
          </Link>
          <Link
            href="/trending"
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-bg transition hover:opacity-90"
          >
            Open app
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
