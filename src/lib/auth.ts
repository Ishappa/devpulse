/**
 * Auth.js (NextAuth v5) configuration — GitHub OAuth.
 *
 * Strategy: JWT (stateless) — no session-table read on every request, lower latency.
 * On first sign-in we upsert the user into Postgres and stash their internal DB id on
 * the token, so authorized handlers can scope queries by `session.user.dbId` without
 * an extra lookup. The GitHub access token is kept server-side in the JWT, never
 * exposed to client JS.
 *
 * Tradeoff: a JWT can't be force-revoked server-side without extra machinery. Acceptable
 * here; we'd add a short maxAge + a denylist if it mattered. (See docs/reference/04.)
 */
import NextAuth, { type DefaultSession } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { env } from '@/lib/env';

declare module 'next-auth' {
  interface Session {
    user: { dbId?: number; githubId?: number } & DefaultSession['user'];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.AUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 },
  providers: [
    GitHub({
      clientId: env.AUTH_GITHUB_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,
    }),
  ],
  callbacks: {
    /** Runs on sign-in (account/profile present) and on subsequent token reads. */
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const githubId = Number(profile.id);
        const [row] = await db
          .insert(users)
          .values({
            githubId,
            email: (profile.email as string | null) ?? null,
            name: (profile.name as string | null) ?? (profile.login as string) ?? null,
            imageUrl: (profile.avatar_url as string | null) ?? null,
          })
          .onConflictDoUpdate({
            target: users.githubId,
            set: { name: (profile.name as string | null) ?? null },
          })
          .returning({ id: users.id });
        token.dbId = row?.id;
        token.githubId = githubId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.dbId = token.dbId as number | undefined;
        session.user.githubId = token.githubId as number | undefined;
      }
      return session;
    },
  },
  pages: { signIn: '/login' },
});
