'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginInner() {
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') ?? '/feed';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-extrabold tracking-tight">
        Dev<span className="text-accent">Pulse</span>
      </h1>
      <p className="mt-2 max-w-sm text-muted">
        Sign in with GitHub to watch technologies and build your personalized momentum feed.
      </p>
      <button
        onClick={() => signIn('github', { callbackUrl })}
        className="mt-6 rounded-md bg-accent px-5 py-2.5 font-medium text-bg transition hover:opacity-90"
      >
        Continue with GitHub
      </button>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
