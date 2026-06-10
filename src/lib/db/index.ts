/**
 * Drizzle + postgres.js client.
 *
 * On serverless (Vercel functions) each invocation can create a new connection,
 * which exhausts Postgres' connection limit. Two mitigations:
 *   1. Point DATABASE_URL at Supabase's PgBouncer pooler (transaction mode).
 *   2. Cap the client's own pool to 1 and disable prepared statements (PgBouncer
 *      transaction mode doesn't support session-level prepared statements).
 * In dev we cache the client on globalThis to survive HMR.
 */
import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';
import * as schema from './schema';

const globalForDb = globalThis as unknown as {
  __pg?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__pg ??
  postgres(env.DATABASE_URL, {
    max: 1,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (env.NODE_ENV !== 'production') globalForDb.__pg = client;

export const db = drizzle(client, { schema });
export { schema };
