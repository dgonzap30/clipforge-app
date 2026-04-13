# Environment Variables Setup

Two `.env` files — one for the Vite frontend, one for the Bun/Hono server.
Both are gitignored. **Never commit real secrets.** Use the matching
`.env.example` as the template and copy it.

```bash
cp .env.example .env
cp server/.env.example server/.env
```

## Root `.env` — frontend (Vite)

Vite only exposes variables prefixed with `VITE_` to the browser.

| Key                      | Purpose                                          |
| ------------------------ | ------------------------------------------------ |
| `VITE_SUPABASE_URL`      | Supabase project URL                             |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (safe for client)              |
| `VITE_API_URL`           | Backend origin (default `http://localhost:8787`) |

## `server/.env` — backend (Bun + Hono)

| Key                                           | Required   | Purpose                                                       |
| --------------------------------------------- | ---------- | ------------------------------------------------------------- |
| `SUPABASE_URL`                                | ✅         | Supabase project URL                                          |
| `SUPABASE_SERVICE_ROLE_KEY`                   | ✅         | Bypasses RLS — server-only, never ship to client              |
| `SUPABASE_ANON_KEY`                           |            | Used by the server when acting on behalf of the user          |
| `TWITCH_CLIENT_ID`                            | ✅         | From https://dev.twitch.tv/console                            |
| `TWITCH_CLIENT_SECRET`                        | ✅         | From https://dev.twitch.tv/console                            |
| `TWITCH_REDIRECT_URI`                         |            | OAuth redirect, default `http://localhost:3000/auth/callback` |
| `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` |            | Google Cloud console (optional, for YouTube upload)           |
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET`  |            | TikTok developer portal (optional)                            |
| `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET`   |            | Meta for Developers (optional)                                |
| `OPENAI_API_KEY`                              |            | Required if `LLM_PROVIDER=openai` (also used for Whisper API) |
| `CLAUDE_API_KEY`                              |            | Required if `LLM_PROVIDER=claude`                             |
| `LLM_PROVIDER`                                |            | `openai` (default) or `claude`                                |
| `ANTHROPIC_API_KEY`                           |            | For Claude Vision (scene analysis)                            |
| `PEXELS_API_KEY`                              |            | B-roll stock footage                                          |
| `REDIS_URL`                                   | ✅         | Default `redis://localhost:6379`                              |
| `JWT_SECRET`                                  | ✅ in prod | Any strong random value                                       |
| `OAUTH_STATE_SECRET`                          | ✅ in prod | Signs OAuth state tokens. Falls back to `JWT_SECRET`          |
| `FRONTEND_URL`                                |            | Public frontend origin (used in OAuth post-redirect)          |
| `CORS_ORIGINS`                                |            | Comma-separated list of allowed origins                       |
| `NODE_ENV`                                    |            | `development` locally, `production` on Railway                |
| `PORT`                                        |            | Default `8787`                                                |

### Generating strong secrets

```bash
# Strong random values for JWT_SECRET / OAUTH_STATE_SECRET
openssl rand -base64 48
```

### Production notes

- Set `OAUTH_STATE_SECRET` to its own value (don't let it fall back to
  `JWT_SECRET`) so rotating one doesn't kneecap the other.
- Redis must be reachable from both the API and worker services.
- If you change `SUPABASE_SERVICE_ROLE_KEY`, restart both API and worker.

## If a secret ever lands in git

1. **Rotate it first** at the provider (Twitch, Supabase, OpenAI, etc.).
2. Then scrub history: `git-filter-repo --invert-paths --path <file>` followed
   by `git push --force-with-lease origin main`.
3. Rotation is what actually protects you — history rewrites come second.
