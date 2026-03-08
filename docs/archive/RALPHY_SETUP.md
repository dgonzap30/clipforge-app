# Ralphy Setup Guide for ClipForge

This project now has a complete Ralphy PRD (Product Requirements Document) ready for autonomous execution.

## What Was Created

### 1. `.ralphy/config.yaml` — Project Configuration
- Defines ClipForge architecture (Hono + React on Bun runtime)
- 18 coding rules enforcing codebase patterns (FFmpeg via Bun shell, Supabase clients, Hono middleware)
- Protected files (locks, node_modules, git, PRD files)
- Test/lint/build commands

### 2. `PRD.yaml` — 19-Task Implementation Plan
Complete implementation roadmap across 6 phases:

**Phase A: Quick Wins (3 tasks)**
- Wire chat log fetching
- Honor all job settings
- Enable split-screen layout

**Phase B: Face Tracking (2 tasks)**
- MediaPipe face detection integration
- Multi-face handling

**Phase C: Caption Enhancement (5 tasks)**
- Animation effects (bounce, glow, fade)
- Style presets (5 styles)
- Emoji insertion
- Filler word removal

**Phase D: Dynamic Effects (3 tasks)**
- Auto-zoom on audio peaks
- Transition effects
- B-roll insertion (LLM-driven)

**Phase E: Platform Publishing (4 tasks)**
- TikTok API integration
- YouTube API integration
- Instagram API integration
- Frontend platform UI

**Phase F: Advanced Scoring (3 tasks)**
- Transcript-aware LLM scoring
- Hook detection
- Visual scene analysis

### Parallel Execution Strategy
Tasks are organized into 6 parallel groups to maximize throughput:
- **Group 1**: Split-screen + face tracking (independent reframe work)
- **Group 2**: Multi-face + animation + presets
- **Group 3**: Emoji + filler removal
- **Group 4**: Transitions + B-roll
- **Group 5**: All 3 platform APIs (TikTok, YouTube, Instagram)
- **Group 6**: All 3 scoring improvements

Sequential tasks run between groups where dependencies exist.

## How to Run

### Prerequisites
1. Install Ralphy: `npm install -g ralphy-cli`
2. Ensure you have Claude Code CLI installed and authenticated
3. Set up required environment variables (see below)

### Execution Commands

**Full parallel execution (recommended):**
```bash
ralphy --yaml PRD.yaml --parallel --max-parallel 5
```

**Dry run (preview tasks):**
```bash
ralphy --yaml PRD.yaml --dry-run
```

**Single task mode (test):**
```bash
ralphy "Wire chat log fetching and restore chat weight in pipeline"
```

**With branch-per-task workflow:**
```bash
ralphy --yaml PRD.yaml --parallel --branch-per-task --create-pr
```

**Sequential execution (slower but safer):**
```bash
ralphy --yaml PRD.yaml
```

### Environment Variables Needed

Before running, ensure these are set in your environment:

**Existing (already in use):**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_REDIRECT_URI`
- `OPENAI_API_KEY` (for Whisper API)
- `REDIS_URL` (for BullMQ)

**New (required for Phase E - Platform Publishing):**
- `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI`
- `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI`
- `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_REDIRECT_URI`

**Optional (for Phase F - Advanced Scoring):**
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` (for LLM-based transcript analysis)
- `PEXELS_API_KEY` (for B-roll stock footage, free tier available)

### Expected Duration

With `--parallel --max-parallel 5`:
- **Phase A-C** (core functionality): ~3-5 hours
- **Phase D-E** (effects + platforms): ~4-6 hours
- **Phase F** (advanced AI): ~2-3 hours
- **Total**: 10-15 hours of autonomous coding

Without parallelization: ~25-30 hours

### Monitoring Progress

Ralphy auto-updates `PRD.yaml` as tasks complete:
```bash
# Watch progress in real-time
watch -n 5 'grep "completed: true" PRD.yaml | wc -l'
```

### Testing After Completion

Each phase has verification steps in the task descriptions. High-level testing:

1. **Phase A**: Process a test VOD, verify chat moments appear in logs
2. **Phase B**: Run reframe on a clip with visible faces, verify face tracking
3. **Phase C**: Check caption output for animations and emojis
4. **Phase D**: Verify zoom effects on audio peaks
5. **Phase E**: Connect to TikTok sandbox, upload a test clip
6. **Phase F**: Compare clip selection quality before/after transcript scoring

### Troubleshooting

**If a task fails:**
- Ralphy retries 3 times by default
- Check logs in `.ralphy/progress.txt`
- Can resume from failed task: `ralphy --yaml PRD.yaml --max-iterations 1`

**If dependencies are missing:**
- Install MediaPipe: `cd server && bun add @mediapipe/tasks-vision`
- Install platform SDKs as tasks require them

**If parallel execution conflicts:**
- Use `--sandbox` mode instead of git worktrees
- Reduce `--max-parallel` to 3

## Next Steps

1. Set environment variables
2. Run `ralphy --yaml PRD.yaml --dry-run` to preview
3. Execute: `ralphy --yaml PRD.yaml --parallel`
4. Monitor progress and test each phase
5. Deploy when all tasks complete

## Notes

- Config protects critical files (locks, node_modules, .git, PRD.yaml, README)
- Rules enforce codebase patterns (Bun shell for FFmpeg, Supabase clients, etc.)
- Each task has detailed acceptance criteria in its description
- Tasks reference exact file paths and line numbers from the audit
