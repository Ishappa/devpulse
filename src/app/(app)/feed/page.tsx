/**
 * /feed — personalized momentum feed (SSR, per-user).
 *
 * Reading the session via auth() reads cookies, which forces this route to render
 * dynamically per request — it can't be cached across users. We gate access server-side:
 * unauthenticated visitors get a sign-in CTA, not a 401 flash.
 */
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { FeedList } from '@/features/watchlist/FeedList';
import { SignInCta } from '@/features/watchlist/SignInCta';

export const metadata: Metadata = { title: 'My Feed' };
export const dynamic = 'force-dynamic';

export default async function FeedPage() {
  const session = await auth();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">My Feed</h1>
      <p className="mb-5 text-sm text-muted">
        Momentum across the repos and topics you watch.
      </p>
      {session?.user?.dbId ? <FeedList /> : <SignInCta />}
    </div>
  );
}
