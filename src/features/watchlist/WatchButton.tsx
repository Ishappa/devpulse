'use client';

/**
 * Watch/unwatch toggle with an OPTIMISTIC update via RTK Query — the UI flips instantly
 * and rolls back if the request fails (see the mutation's onQueryStarted). Unauthenticated
 * users are routed to sign-in.
 */
import { useSession, signIn } from 'next-auth/react';
import {
  useGetWatchesQuery,
  useAddWatchMutation,
  useRemoveWatchMutation,
} from '@/store/api';

export function WatchButton({ entityId }: { entityId: number }) {
  const { status } = useSession();
  const authed = status === 'authenticated';
  const { data: watches } = useGetWatchesQuery(undefined, { skip: !authed });
  const [add] = useAddWatchMutation();
  const [remove] = useRemoveWatchMutation();

  const watching = !!watches?.includes(entityId);

  if (!authed) {
    return (
      <button
        onClick={() => signIn('github')}
        className="rounded-md border border-border px-3 py-1 text-sm text-muted transition hover:text-text"
      >
        Watch
      </button>
    );
  }

  return (
    <button
      onClick={() => (watching ? remove(entityId) : add(entityId))}
      aria-pressed={watching}
      className={`rounded-md border px-3 py-1 text-sm transition ${
        watching
          ? 'border-accent-2/40 bg-accent-2/10 text-accent-2'
          : 'border-border text-muted hover:text-text'
      }`}
    >
      {watching ? '✓ Watching' : 'Watch'}
    </button>
  );
}
