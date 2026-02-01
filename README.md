# 🔥 ClipForge

Automatic Twitch stream clipper & short-form content optimizer.

Turn hours of VODs into viral-ready TikToks, Reels, and Shorts — automatically.

## Tech Stack

- **Runtime:** [Bun](https://bun.sh)
- **Framework:** React 19 + TypeScript
- **Build:** Vite 6
- **Styling:** Tailwind CSS
- **Routing:** React Router 7
- **State:** Zustand
- **Icons:** Lucide React

## Getting Started

```bash
# Frontend
bun install
bun dev           # → http://localhost:3000

# Backend (in another terminal)
cd server
cp .env.example .env
# Add your Twitch credentials to .env
bun install
bun dev           # → http://localhost:8787
```

### Required: Twitch App Setup
1. Go to https://dev.twitch.tv/console
2. Create a new application
3. Set OAuth redirect to `http://localhost:3000/auth/callback`
4. Copy Client ID and Client Secret to `server/.env`

## Project Structure

```
clipforge/
├── public/              # Static assets
├── src/                 # Frontend (React)
│   ├── components/      # React components
│   │   ├── dashboard/   # Dashboard widgets
│   │   ├── layout/      # Layout components
│   │   └── ui/          # Reusable UI components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utilities + API client
│   ├── pages/           # Route pages
│   └── store/           # Zustand state management
├── server/              # Backend (Bun + Hono)
│   └── src/
│       ├── routes/      # API endpoints
│       ├── lib/         # Twitch client, env
│       ├── analysis/    # Chat, audio, signal fusion
│       ├── extraction/  # Clipper, reframer
│       └── captions/    # Whisper transcription
└── package.json
```

## Pages

- `/` - Dashboard (overview, stats, recent clips)
- `/clips` - Clip gallery & management
- `/queue` - Processing queue
- `/settings` - User preferences
- `/connect` - Auth/onboarding

## Next Steps

See `BUILD_PLAN.md` for the development roadmap.

---

Built with 🔥 by Diego + AI
