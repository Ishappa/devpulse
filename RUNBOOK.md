# DevPulse — Runbook

Everything you need to operate, trigger, and redeploy DevPulse.

---

## 1. Where each secret comes from

| Variable | What it is | Where to find / regenerate |
|---|---|---|
| `DATABASE_URL` | Supabase session pooler (port 6543) | supabase.com → project → Settings → Database → Connection string → URI (Transaction mode) |
| `DATABASE_URL_DIRECT` | Supabase direct connection (port 5432, for migrations only) | Same page — Direct connection tab |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint | console.upstash.com → devpulse-cache → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token | Same page |
| `AUTH_SECRET` | Random string that signs JWT sessions | Regenerate: `openssl rand -base64 32` |
| `AUTH_GITHUB_ID` | GitHub OAuth App Client ID | github.com → Settings → Developer settings → OAuth Apps → your app |
| `AUTH_GITHUB_SECRET` | GitHub OAuth App Client Secret | Same page (regenerate if lost) |
| `GITHUB_TOKEN` | Personal access token for GitHub Search API (higher rate limits) | github.com → Settings → Developer settings → Personal access tokens → Fine-grained |
| `CRON_SECRET` | **Your own** random string that protects `/api/cron/ingest` | It's already in `.env.local` — no external service. Regenerate: `openssl rand -base64 32` |

### Current values (keep this file out of git)

```
CRON_SECRET=X8vNCApubbOMfkqwsTofEj6hGzdiWIOjFep3wxmpN84=
```

The Bearer token in curl commands IS the `CRON_SECRET`. The API checks:
```
Authorization: Bearer <CRON_SECRET>
```
It has nothing to do with GitHub or Upstash.

---

## 2. Trigger ingest manually

### Production
```bash
curl -X POST https://devpulse-two-zeta.vercel.app/api/cron/ingest \
  -H "Authorization: Bearer X8vNCApubbOMfkqwsTofEj6hGzdiWIOjFep3wxmpN84="
```
Returns `{"ok":true,"status":"started"}` immediately. Background job takes ~15 sec.
Refresh the site after ~20 seconds to see fresh data.

### Local dev
```bash
curl -X POST http://localhost:3000/api/cron/ingest \
  -H "Authorization: Bearer X8vNCApubbOMfkqwsTofEj6hGzdiWIOjFep3wxmpN84="
```

Or just open the browser and visit:
```
http://localhost:3000/api/cron/ingest
```
(GET also works in development)

---

## 3. Database operations

### Run migrations (push schema to Supabase)
```bash
npm run db:push
```

### Seed sample data (for local testing)
```bash
npm run db:seed
```

### Reset database + flush Redis cache
```bash
npm run db:reset
```

### View live data
- Go to supabase.com → your project → Table Editor
- Tables: `entities`, `snapshots`, `watches`, `entity_tags`

---

## 4. Local development setup

```bash
# 1. Install dependencies
npm install

# 2. Env file is already configured at .env.local
# (uses same Supabase + Redis as production)

# 3. Start dev server
npm run dev

# 4. Trigger first ingest to populate data
curl -X POST http://localhost:3000/api/cron/ingest \
  -H "Authorization: Bearer X8vNCApubbOMfkqwsTofEj6hGzdiWIOjFep3wxmpN84="
```

---

## 5. How deployment was set up (step by step)

### Infrastructure created
| Service | Project name | Plan |
|---|---|---|
| Supabase | devpulse-db | Free |
| Upstash Redis | devpulse-cache | Free |
| Vercel | devpulse | Hobby |
| GitHub OAuth App | DevPulse Production | — |

### GitHub OAuth App setup
1. github.com → Settings → Developer settings → OAuth Apps → New OAuth App
2. Homepage URL: `https://devpulse-two-zeta.vercel.app`
3. Callback URL: `https://devpulse-two-zeta.vercel.app/api/auth/callback/github`
4. Copy Client ID → `AUTH_GITHUB_ID`
5. Generate Client Secret → `AUTH_GITHUB_SECRET`

### Vercel project setup
1. Go to vercel.com → New Project → Import from GitHub (`Ishappa/devpulse`)
2. Add all env vars from `.env.production` in Settings → Environment Variables
3. Deploy via CLI:
   ```bash
   npx vercel link --project devpulse --yes
   npx vercel --prod
   ```

### Env vars added to Vercel
All variables from `.env.production` were added as Production + Preview:
- `DATABASE_URL`
- `DATABASE_URL_DIRECT`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `AUTH_SECRET`
- `AUTH_GITHUB_ID` ← production OAuth app (different from local)
- `AUTH_GITHUB_SECRET` ← production OAuth app
- `GITHUB_TOKEN`
- `CRON_SECRET`

### Cron job
Set in `vercel.json` — runs daily at 6AM UTC (Vercel Hobby plan limit: max once per day):
```json
{
  "crons": [{ "path": "/api/cron/ingest", "schedule": "0 6 * * *" }]
}
```

### Future redeployment
Just push to `main` — Vercel auto-deploys:
```bash
git add .
git commit -m "your message"
git push origin main
```

---

## 6. Live URLs

| | URL |
|---|---|
| Production | https://devpulse-two-zeta.vercel.app |
| Vercel dashboard | https://vercel.com/ishwarkuri4-gmailcoms-projects/devpulse |
| GitHub repo | https://github.com/Ishappa/devpulse |
| Supabase | https://supabase.com/dashboard/project/devdsdoluxnuczueqtik |
| Upstash Redis | https://console.upstash.com |

---

## 7. Adding a new tracked language

Edit only one file: `src/config/tech.ts`

```ts
export const TRACKED_LANGUAGES = [
  'TypeScript', 'JavaScript', 'Java', 'Kotlin', 'Swift', 'Python',
  'Rust',  // ← add here
] as const;
```

That's it — trending page, radar dropdown, and ingest pipeline all pick it up automatically.
