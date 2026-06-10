/**
 * POST /api/jobs/ingest-entity — QStash worker callback.
 *
 * Persists a single pre-computed snapshot. Idempotent (insert-on-conflict-do-nothing),
 * so QStash's at-least-once redelivery is safe. The request signature is verified at
 * REQUEST time (not module load) against QStash's signing keys, so only the queue can
 * invoke this endpoint — and the route still builds when keys aren't configured.
 */
import { Receiver } from '@upstash/qstash';
import { persistSnapshot, SnapshotWriteSchema } from '@/lib/ingest';
import { fail, ok, validationError } from '@/lib/api';

export const dynamic = 'force-dynamic';

async function verifySignature(req: Request, body: string): Promise<boolean> {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) return false;

  const signature = req.headers.get('upstash-signature') ?? '';
  try {
    const receiver = new Receiver({ currentSigningKey, nextSigningKey });
    return await receiver.verify({ signature, body });
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!(await verifySignature(req, raw))) return fail(401, 'UNAUTHORIZED');

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return fail(400, 'VALIDATION');
  }

  const parsed = SnapshotWriteSchema.safeParse(json);
  if (!parsed.success) return validationError(parsed.error);

  try {
    await persistSnapshot(parsed.data);
    return ok({ ok: true });
  } catch (err) {
    console.error('[jobs/ingest-entity] failed', err);
    // 500 → QStash will retry; idempotency makes that safe.
    return fail(500, 'INTERNAL');
  }
}
