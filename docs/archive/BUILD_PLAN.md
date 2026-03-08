# 🔥 ClipForge Build Plan

Your morning briefing. Here's what to tackle.

---

## ✅ Already Done (Scaffolding)

- [x] React + TypeScript + Vite setup (Bun-ready)
- [x] Tailwind CSS with custom brand colors
- [x] React Router with all pages stubbed
- [x] Layout system (sidebar, header)
- [x] Zustand store with types
- [x] All page shells with placeholder UI
- [x] Component structure in place

---

## 🚀 Day 1 Priority: Backend Foundation

The frontend is pretty — now you need brains.

### 1. Twitch OAuth Integration

**Where:** Create `src/lib/twitch.ts` + update `/connect` page

```typescript
// Key endpoints you'll need:
// Auth: https://id.twitch.tv/oauth2/authorize
// Token: https://id.twitch.tv/oauth2/token
// User: https://api.twitch.tv/helix/users
// VODs: https://api.twitch.tv/helix/videos
```

**Steps:**
1. Create Twitch dev app at https://dev.twitch.tv/console
2. Get Client ID + Client Secret
3. Implement OAuth PKCE flow (SPA-safe)
4. Store tokens in Zustand (already has user state)
5. Wire up the Connect page button

**Scopes needed:** `user:read:email`, `clips:edit` (later for clip creation)

### 2. VOD Fetching

**Where:** Create `src/lib/api/vods.ts`

```typescript
interface TwitchVOD {
  id: string
  user_id: string
  user_name: string
  title: string
  duration: string // "3h24m15s" format
  url: string
  thumbnail_url: string
  created_at: string
}
```

**API endpoint:** `GET https://api.twitch.tv/helix/videos?user_id={id}&type=archive`

Hook this into the Queue page's "Add Stream" flow.

### 3. Backend Server (Choose Your Fighter)

You need a backend for:
- Video processing (can't do FFmpeg in browser)
- Chat log storage/analysis
- Job queue management

**Option A: Bun + Hono (Recommended)**
```bash
mkdir server && cd server
bun init
bun add hono
```

Fast, TypeScript-native, matches your frontend stack.

**Option B: Python + FastAPI**
Better if you're doing heavy ML stuff (Whisper, face detection).

**Option C: Cloudflare Workers + R2**
Serverless, cheap, but more complex for video processing.

---

## 📅 Day 2-3: Core Detection Pipeline

### Chat Analysis Engine

**Where:** `server/src/analysis/chat.ts`

1. **Ingest chat logs** from Twitch (they provide chat replay for VODs)
2. **Calculate velocity** — messages per 5-second window
3. **Detect emote clusters** — track PogChamp, LUL, etc.
4. **Output timestamps** with hype scores

```typescript
interface ChatMoment {
  timestamp: number      // seconds into VOD
  velocity: number       // messages per window
  emoteScore: number     // weighted emote density
  hydeScore: number      // combined score
}
```

### Audio Peak Detection

**Where:** `server/src/analysis/audio.ts`

1. Extract audio track with FFmpeg
2. Analyze volume levels over time
3. Detect spikes above threshold
4. Cross-reference with chat data

```bash
# Extract audio for analysis
ffmpeg -i input.mp4 -vn -acodec pcm_s16le -ar 16000 -ac 1 audio.wav
```

Use a library like `audiowaveform` or write custom peak detection.

---

## 📅 Day 4-5: Clip Extraction & Reframing

### Clip Extraction

**Where:** `server/src/extraction/clipper.ts`

```typescript
interface ClipConfig {
  vodUrl: string
  startTime: number
  endTime: number
  preRoll: number    // seconds before peak
  postRoll: number   // seconds after peak
}

async function extractClip(config: ClipConfig): Promise<string> {
  // Use FFmpeg to cut segment
  // Return path to extracted clip
}
```

### Vertical Reframing (The Hard Part)

**Where:** `server/src/extraction/reframe.ts`

Options:
1. **MediaPipe Face Detection** — Track faces, generate crop coordinates
2. **YOLO Object Detection** — For gameplay tracking
3. **Static crop** — Start simple, just center crop

```typescript
interface CropPath {
  keyframes: Array<{
    time: number
    x: number
    y: number
    width: number
    height: number
  }>
}
```

FFmpeg can apply dynamic crops with the `crop` filter and keyframe interpolation.

---

## 📅 Day 6-7: Polish & Captions

### Auto-Captions

**Where:** `server/src/captions/transcribe.ts`

1. Run Whisper on extracted clips (local or API)
2. Get word-level timestamps
3. Generate SRT/ASS subtitles
4. Burn in with FFmpeg or keep as sidecar

### Caption Styling

For that TikTok look:
- White text with black outline
- Word-by-word highlighting
- Use ASS format for animations

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │Dashboard│ │  Clips  │ │  Queue  │ │Settings │ │ Connect │  │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘  │
│       └───────────┴───────────┴───────────┴───────────┘        │
│                              │ Zustand                          │
└──────────────────────────────┼──────────────────────────────────┘
                               │ REST/WebSocket
┌──────────────────────────────┼──────────────────────────────────┐
│                        BACKEND (Bun/Hono)                       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│  │  Auth   │ │   API   │ │ Workers │ │ Storage │              │
│  │(Twitch) │ │(Routes) │ │ (Jobs)  │ │  (S3)   │              │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘              │
└───────┼───────────┼───────────┼───────────┼─────────────────────┘
        │           │           │           │
┌───────┴───────────┴───────────┴───────────┴─────────────────────┐
│                      PROCESSING PIPELINE                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │  Chat   │→│  Audio  │→│  Peak   │→│ Extract │→│ Reframe │  │
│  │ Ingest  │ │Analysis │ │ Fusion  │ │  Clips  │ │  9:16   │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
│                                              │                  │
│                                    ┌─────────┴─────────┐       │
│                                    │   Caption/Export  │       │
│                                    └───────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Suggested File Structure (Backend)

```
server/
├── src/
│   ├── index.ts           # Hono app entry
│   ├── routes/
│   │   ├── auth.ts        # Twitch OAuth
│   │   ├── vods.ts        # VOD listing/queue
│   │   ├── clips.ts       # Clip CRUD
│   │   └── jobs.ts        # Processing status
│   ├── analysis/
│   │   ├── chat.ts        # Chat velocity
│   │   ├── audio.ts       # Audio peaks
│   │   └── fusion.ts      # Signal combination
│   ├── extraction/
│   │   ├── clipper.ts     # FFmpeg cutting
│   │   └── reframe.ts     # Vertical conversion
│   ├── captions/
│   │   ├── transcribe.ts  # Whisper
│   │   └── style.ts       # ASS generation
│   └── lib/
│       ├── twitch.ts      # API client
│       ├── ffmpeg.ts      # FFmpeg wrapper
│       └── storage.ts     # S3/local
├── package.json
└── tsconfig.json
```

---

## 🎯 Quick Wins for Tomorrow

1. **Get Twitch OAuth working** — This unlocks everything
2. **Fetch and display real VODs** — Replace mock data
3. **Set up backend with one endpoint** — `/api/health`
4. **Store a real VOD URL in the queue** — End-to-end flow

---

## 💡 Pro Tips

- **Start with VOD-first**, live monitoring is 10x harder
- **Use existing Twitch clips as training data** — They already know what's good
- **Cache aggressively** — VOD analysis is expensive
- **WebSocket for progress updates** — Don't poll
- **Consider BullMQ for job queue** — Reliable, Redis-backed

---

## 🔗 Useful Resources

- [Twitch API Docs](https://dev.twitch.tv/docs/api/)
- [Twitch Chat IRC Guide](https://dev.twitch.tv/docs/irc/)
- [FFmpeg Filters](https://ffmpeg.org/ffmpeg-filters.html)
- [MediaPipe Face Detection](https://developers.google.com/mediapipe)
- [Whisper API](https://platform.openai.com/docs/guides/speech-to-text)
- [Hono Framework](https://hono.dev/)

---

*Now go build something fucking cool.* 🚀
