/**
 * /api/watches — the authenticated user's watchlist.
 *   GET    → list watched entity ids
 *   POST   → add a watch          { entityId }
 *   DELETE → remove a watch       { entityId }
 *
 * Authorization: every operation is scoped to `session.user.dbId`. We never trust a
 * user id from the body — a user can only mutate their own watches.
 */
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { watches } from '@/lib/db/schema';
import { WatchBodySchema } from '@/schemas';
import { authedLimiter, checkLimit } from '@/lib/ratelimit';
import { ok, fail, validationError, rateLimited } from '@/lib/api';
import { invalidate } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  const userId = session?.user?.dbId;
  if (!userId) return fail(401, 'UNAUTHORIZED');

  const rows = await db
    .select({ entityId: watches.entityId })
    .from(watches)
    .where(eq(watches.userId, userId));
  return ok({ data: rows.map((r) => r.entityId) });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.dbId;
  if (!userId) return fail(401, 'UNAUTHORIZED');

  const { success, retryAfter } = await checkLimit(authedLimiter, `watch:${userId}`);
  if (!success) return rateLimited(retryAfter);

  const parsed = WatchBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);

  await db
    .insert(watches)
    .values({ userId, entityId: parsed.data.entityId })
    .onConflictDoNothing({ target: [watches.userId, watches.entityId] });
  await invalidate(`feed:${userId}`);
  return ok({ ok: true }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await auth();
  const userId = session?.user?.dbId;
  if (!userId) return fail(401, 'UNAUTHORIZED');

  const parsed = WatchBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);

  await db
    .delete(watches)
    .where(and(eq(watches.userId, userId), eq(watches.entityId, parsed.data.entityId)));
  await invalidate(`feed:${userId}`);
  return ok({ ok: true });
}
