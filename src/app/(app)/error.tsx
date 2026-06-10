'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // In production this is where we'd report to Sentry.
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-500/30 bg-red-500/5 py-16 text-center">
      <p className="text-lg font-medium text-red-400">Something went wrong</p>
      <p className="mt-1 max-w-sm text-sm text-muted">
        An unexpected error occurred while loading this view.
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-md border border-border px-4 py-2 text-sm text-text hover:border-accent/50"
      >
        Try again
      </button>
    </div>
  );
}
