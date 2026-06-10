'use client';

import { signIn } from 'next-auth/react';

export function SignInCta() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-bg-soft/40 py-16 text-center">
      <p className="text-lg font-medium">Sign in to build your feed</p>
      <p className="mt-1 max-w-sm text-sm text-muted">
        Connect with GitHub to watch technologies and track their momentum over time.
      </p>
      <button
        onClick={() => signIn('github')}
        className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90"
      >
        Sign in with GitHub
      </button>
    </div>
  );
}
