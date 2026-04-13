# Deploy — Internal Testing

Target setup:

- **Railway** → Redis (plugin), API service, Worker service
- **Vercel** → Frontend (Vite SPA)
- **Supabase** → already provisioned; just run new migrations

Both the API and Worker come from the same Docker image (`server/Dockerfile`)
but use different start commands. The worker does all the heavy lifting
(FFmpeg, yt-dlp, Whisper) so only it needs the `/tmp/clipforge` volume.

---

## 1. Supabase — run migrations

Apply `server/migrations/003_fix_rls_policies.sql` to the project. It's
idempotent (uses `DROP POLICY IF EXISTS` and `CREATE POLICY`).

Confirm the `001` and `002_*` migrations are already applied — if not, apply
them in order: `001`, `002_create_platform_connections_table`,
`002_add_instagram_support`, then `003`.

Create two Supabase **Storage buckets** if they don't exist already (the
upload stage writes into them — confirm exact names against
`server/src/pipeline/stages/upload.ts` before going live):

- `clips` (public — served via signed URLs)
- anything else the upload stage references

---

## 2. Railway — API + Worker + Redis

One project, three services. From the repo root:

```bash
railway login
railway init            # name: clipforge
```

### 2a. Redis

In the Railway dashboard → **+ New** → **Database** → **Add Redis**.
Note the `REDIS_URL` it exposes; the other services will reference it.

### 2b. API service

**+ New** → **GitHub Repo** → `dgonzap30/clipforge-app` → **Settings**:

- **Root Directory:** `server`
- **Builder:** Dockerfile (auto-detected from `server/railway.toml`)
- **Start Command:** `bun run start:api` (default)
- **Custom Domain:** assign a subdomain, e.g. `api.clipforge.up.railway.app`

**Environment variables** (paste in bulk via Railway's Raw Editor):

```
SUPABASE_URL=<from supabase dashboard>
SUPABASE_SERVICE_ROLE_KEY=<from supabase dashboard>
SUPABASE_ANON_KEY=<from supabase dashboard>
TWITCH_CLIENT_ID=<dev.twitch.tv>
TWITCH_CLIENT_SECRET=<dev.twitch.tv>
TWITCH_REDIRECT_URI=https://<your-frontend-domain>/auth/callback
REDIS_URL=${{Redis.REDIS_URL}}
OPENAI_API_KEY=<optional>
CLAUDE_API_KEY=<optional>
LLM_PROVIDER=openai
PEXELS_API_KEY=<optional>
JWT_SECRET=<openssl rand -base64 48>
OAUTH_STATE_SECRET=<openssl rand -base64 48>
FRONTEND_URL=https://<your-frontend-domain>
CORS_ORIGINS=https://<your-frontend-domain>
NODE_ENV=production
PORT=8787
```

Optional platform credentials (only if you want to test those uploads):

```
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REDIRECT_URI=https://<api-domain>/api/platforms/youtube/callback
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=https://<api-domain>/api/platforms/tiktok/callback
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
INSTAGRAM_REDIRECT_URI=https://<api-domain>/api/platforms/instagram/callback
ANTHROPIC_API_KEY=
```

### 2c. Worker service

Duplicate the API service setup (same repo, same root directory, same env
vars) but override:

- **Start Command:** `bun run start:worker`
- **Health Check:** disabled (worker has no HTTP port)
- **No public domain**
- **Volume:** mount a 20 GB volume at `/tmp/clipforge`
- **WORKER_CONCURRENCY:** set to `2` (or `1` for a small instance)

Reuse the API service's env vars by linking them (Railway → Reference
Variables) so rotations stay in sync.

---

## 3. Vercel — Frontend

From the repo root:

```bash
npx vercel link
npx vercel env add VITE_SUPABASE_URL production
npx vercel env add VITE_SUPABASE_ANON_KEY production
npx vercel env add VITE_API_URL production   # https://<api-domain>
npx vercel --prod
```

Build command / framework detection is handled by `vercel.json`.

---

## 4. OAuth redirect URIs

Update every OAuth app's redirect URI to point at the production API domain:

- **Twitch** → `https://<frontend-domain>/auth/callback` (Supabase Auth handles it)
- **YouTube** → `https://<api-domain>/api/platforms/youtube/callback`
- **TikTok** → `https://<api-domain>/api/platforms/tiktok/callback`
- **Instagram** → `https://<api-domain>/api/platforms/instagram/callback`

---

## 5. Smoke test

1. Open the Vercel URL, sign in with Twitch.
2. Pick a short VOD (5–10 min) and queue a job.
3. Watch Railway worker logs: you should see each of the 8 pipeline stages.
4. Clips appear in `/clips`, playable in the modal, downloadable.
5. Kill the worker mid-job (`railway redeploy` on the worker service while
   a job is active) and confirm BullMQ retries it. Expected behaviour:
   the pipeline restarts from stage 1 — state-per-stage isn't persisted
   yet (tracked for a post-beta fix).

---

## Known limitations in this deploy

- Worker restarts replay the entire pipeline from stage 1.
- YouTube OAuth state survives restarts now (HMAC-signed), but the Instagram
  flow still trusts state on the `/instagram/save` side; only Instagram user
  metadata is used for identity in that flow.
- TikTok/Instagram/YouTube upload paths haven't been smoke-tested end-to-end.
- `clips` and `vods` tables were not originally version-controlled — migration
  `003` only ensures RLS policies exist; it does not create the tables. If
  they somehow don't exist in your Supabase project, create them manually
  from the upsert payloads in `server/src/routes/vods.ts` and
  `server/src/routes/clips.ts`.
