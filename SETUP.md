# DevPulse — Local Setup Reference

## What's working
- GitHub OAuth sign-in (Auth.js v5)
- Supabase Postgres (tables created via `db:push`)
- Upstash Redis (rate limiting + caching)
- Next.js 14 App Router (ISR, SSG, dynamic routes)

## Services used
| Service | Purpose | Free tier |
|---|---|---|
| Supabase | Postgres database | 500 MB, 2 projects |
| Upstash Redis | Cache + rate limiting | 10K req/day |
| GitHub OAuth App | Authentication | Free |
| Vercel | Hosting + cron (on deploy) | Free hobby plan |

## Environment variables (.env.local)
```
DATABASE_URL          — Supabase Transaction Pooler (port 6543)  → runtime queries
DATABASE_URL_DIRECT   — Supabase Session Pooler    (port 5432)  → migrations (db:push, db:seed)
UPSTASH_REDIS_REST_URL / TOKEN  — Upstash Redis REST API
AUTH_SECRET           — 32-byte random secret (openssl rand -base64 32)
AUTH_GITHUB_ID        — GitHub OAuth App Client ID
AUTH_GITHUB_SECRET    — GitHub OAuth App Client Secret
GITHUB_TOKEN          — GitHub PAT (for ingest API rate limits, optional locally)
CRON_SECRET           — Secret header checked by /api/cron/ingest
QSTASH_TOKEN / CURRENT_SIGNING_KEY / NEXT_SIGNING_KEY — Upstash QStash (optional locally)
```

## Supabase connection strings
- Transaction Pooler (DATABASE_URL): `postgresql://postgres.devdsdoluxnuczueqtik:[PASS]@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres`
- Session Pooler (DATABASE_URL_DIRECT): `postgresql://postgres.devdsdoluxnuczueqtik:[PASS]@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres`
- Password: stored in .env.local (never commit this file)

## GitHub OAuth App
- App name: DevPulse Local
- Homepage URL: http://localhost:3000
- Callback URL: http://localhost:3000/api/auth/callback/github
- For production on Vercel: add a second OAuth App with your Vercel domain

## Common commands
```bash
yarn dev              # start dev server
npm run db:push       # create/sync tables (run after schema changes)
npm run db:seed       # populate sample data (run once after db:push)
npm run db:studio     # open Drizzle Studio to browse data
npx vitest            # run unit + integration tests
npx playwright test   # run E2E smoke tests (needs yarn build + yarn start first)
```

## First-time setup checklist
- [x] GitHub OAuth App created
- [x] Supabase project created (devpulse-db)
- [x] Upstash Redis created (devpulse-cache)
- [x] .env.local populated with real credentials
- [x] npm run db:push (tables created)
- [ ] npm run db:seed (sample data — run this to see trending data)
- [ ] Vercel deploy (add env vars in Vercel dashboard)
- [ ] Create second GitHub OAuth App for production Vercel URL

## Populating data locally
Option 1 — seed script (fake data, instant):
  npm run db:seed

Option 2 — real ingest (live GitHub + HN data):
  curl -X POST http://localhost:3000/api/cron/ingest \
    -H "Authorization: Bearer <CRON_SECRET from .env.local>"

## Vercel deployment
1. Push repo to GitHub
2. Import project in Vercel
3. Add all env vars from .env.local to Vercel environment variables
4. For DATABASE_URL on Vercel: use Transaction Pooler (port 6543)
5. Cron job runs automatically every 15 min (defined in vercel.json)
