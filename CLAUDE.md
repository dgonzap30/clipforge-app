# ClipForge

Automatic Twitch stream clipper and short-form content optimizer. Turns VODs into vertical clips for TikTok/Reels/Shorts using audio analysis, chat signals, and FFmpeg processing.

## Architecture

Monorepo with two separate apps sharing a Supabase backend:

- **Frontend** (`/`): React 19 + Vite 6 SPA — dashboard for managing VODs, clips, and processing jobs
- **Server** (`/server`): Bun + Hono API — handles Twitch auth, VOD analysis, FFmpeg pipeline, job queue

Both use Bun as the runtime. Frontend runs on port 3000 (Vite), server on port 8787.

## Directory Structure

```
/                           # Frontend (React SPA)
  src/
    components/
      auth/                 # ProtectedRoute
      clips/                # ClipCard, ClipPlayerModal
      dashboard/            # ProcessingQueue, RecentClips
      layout/               # Header, Layout, Sidebar
      queue/                # JobCard, PipelineSteps, VodBrowserModal
      settings/             # PlatformConnection
      ui/                   # EmptyState, LoadingSpinner, Modal, StatsCard
    hooks/                  # Custom hooks
    lib/                    # Utilities, API client
    pages/                  # Route pages (Dashboard, Clips, Queue, Settings, Connect)
    store/                  # Zustand store (index.ts)
    utils/

server/                     # Backend (Bun + Hono)
  src/
    routes/                 # API endpoints: auth, vods, clips, jobs, platforms
    lib/                    # Twitch client, env config, Supabase, LLM, social platform clients
    analysis/               # Chat analysis, audio peaks, visual detection, signal fusion
    extraction/             # FFmpeg clipper, vertical reframer
    captions/               # Whisper transcription
    pipeline/               # Orchestrator, stage definitions, types
      stages/               # download, analyze, extract, reframe, effects, caption, broll, upload
    queue/                  # BullMQ job queue, Redis connection, worker
    middleware/             # Auth middleware
```

## Key Patterns

- **Path alias**: `@/*` maps to `./src/*` (both frontend and imports)
- **State management**: Zustand with `persist` middleware (localStorage key: `clipforge-storage`)
- **Routing**: React Router v7 with `ProtectedRoute` wrapper, `Layout` as parent route
- **Styling**: Tailwind CSS with `clsx` + `tailwind-merge` for conditional classes
- **Icons**: Lucide React throughout
- **Data fetching**: TanStack React Query on frontend
- **Server framework**: Hono with Zod validation (`@hono/zod-validator`)
- **Job queue**: BullMQ + Redis (ioredis) for VOD processing jobs
- **Pipeline**: Sequential stage-based orchestrator (download -> analyze -> extract -> reframe -> effects -> caption -> broll -> upload)
- **Testing**: Vitest with happy-dom environment, setup file at `src/test/setup.ts`. Server uses `bun test`
- **TypeScript**: Strict mode enabled, `noUnusedLocals` and `noUnusedParameters` on

## Common Commands

```bash
# Frontend
bun install && bun dev                    # Start frontend dev server (port 3000)
bun run build                             # Type-check + build
bun run test                              # Run Vitest in watch mode
bun run test:run                          # Run tests once
bun run lint                              # ESLint

# Server
cd server
bun install && bun dev                    # Start server with --watch (port 8787)
bun test                                  # Run server tests

# Full stack (from root)
./start.sh                                # Start Redis + backend + frontend
./stop.sh                                 # Stop all services

# Docker (Redis only for dev)
docker compose up redis -d                # Start Redis for job queue
```

## Environment Setup

Server env vars go in `server/.env` (copy from `server/.env.example`):

- **Required**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **Twitch**: `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`
- **Redis**: `REDIS_URL` (default: `redis://localhost:6379`)
- **LLM**: `OPENAI_API_KEY` or `CLAUDE_API_KEY` + `LLM_PROVIDER`
- **B-roll**: `PEXELS_API_KEY` for stock footage
- **Social platforms**: TikTok, YouTube, Instagram OAuth credentials

## Testing

- Frontend: Vitest + Testing Library + happy-dom. Test files co-located (e.g., `JobCard.test.tsx`)
- Server: `bun test`. Tests co-located next to source files and in `__tests__/` directories
- Pipeline stages each have their own test files
- Run `tsc --noEmit` before considering any change complete

## Key Technical Details

- **Pipeline orchestrator** (`server/src/pipeline/orchestrator.ts`): Central processing engine. Retries handled by BullMQ at the job level, not per-stage
- **Signal fusion** (`server/src/analysis/fusion.ts`): Combines chat, audio, visual, and viewer clip signals with configurable weights
- **FFmpeg**: Used for video extraction, reframing (vertical crop), captioning, and B-roll insertion
- **Twitch OAuth**: Handled via Supabase Auth, app access tokens for API calls
- **ESLint**: Flat config (`eslint.config.js`), unused vars warn with `^_` pattern exception
