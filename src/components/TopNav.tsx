'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';

const LINKS = [
  { href: '/trending', label: 'Trending' },
  { href: '/radar', label: 'Radar' },
  { href: '/feed', label: 'My Feed' },
];

export function TopNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
        <Link href="/" className="text-lg font-extrabold tracking-tight">
          Dev<span className="text-accent">Pulse</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden flex-1 items-center gap-1 sm:flex">
          {LINKS.map((l) => {
            const active = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  active ? 'bg-bg-card text-text' : 'text-muted hover:text-text'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        {/* Spacer on mobile */}
        <div className="flex-1 sm:hidden" />

        {/* Auth — desktop */}
        <div className="hidden sm:flex sm:items-center sm:gap-3">
          {status === 'authenticated' ? (
            <>
              <span className="text-sm text-muted">{session.user?.name}</span>
              <button
                onClick={() => signOut()}
                className="rounded-md border border-border px-3 py-1 text-sm text-muted hover:text-text"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={() => signIn('github')}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-bg transition hover:opacity-90"
            >
              Sign in
            </button>
          )}
        </div>

        {/* Hamburger — mobile only */}
        <button
          className="flex h-8 w-8 flex-col items-center justify-center gap-1.5 sm:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          <span className={`block h-0.5 w-5 bg-text transition-transform ${open ? 'translate-y-2 rotate-45' : ''}`} />
          <span className={`block h-0.5 w-5 bg-text transition-opacity ${open ? 'opacity-0' : ''}`} />
          <span className={`block h-0.5 w-5 bg-text transition-transform ${open ? '-translate-y-2 -rotate-45' : ''}`} />
        </button>
      </nav>

      {/* Mobile dropdown */}
      {open && (
        <div className="border-t border-border bg-bg px-4 pb-4 sm:hidden">
          <div className="flex flex-col gap-1 pt-2">
            {LINKS.map((l) => {
              const active = pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-md px-3 py-2 text-sm transition ${
                    active ? 'bg-bg-card text-text' : 'text-muted hover:text-text'
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
            <div className="mt-2 border-t border-border pt-2">
              {status === 'authenticated' ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">{session.user?.name}</span>
                  <button
                    onClick={() => { signOut(); setOpen(false); }}
                    className="rounded-md border border-border px-3 py-1 text-sm text-muted hover:text-text"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { signIn('github'); setOpen(false); }}
                  className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-bg transition hover:opacity-90"
                >
                  Sign in with GitHub
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
