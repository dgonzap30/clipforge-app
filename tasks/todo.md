# Release Checklist — ClipForge

**Last Updated**: 2026-03-08
**Branch**: main (41 ahead of origin, ~79 uncommitted changes)
**Commits**: 149 total
**Tests**: 44/46 test files failing, 15/92 individual tests failing
**TypeScript**: Compiles clean (0 errors)

---

## S1 — Code Stabilization (Mar 10–14)
- [ ] Fix fusion.test.ts failures (7 tests — transcript handling weight/convergence assertions)
- [ ] Fix JobCard.test.tsx failures (4 tests — status display/progress bar assertions)
- [ ] Fix useAuth.test.ts failure (1 test — vi.mocked / act() wrapping issue)
- [ ] Fix VodBrowserModal.test.tsx failures (label text query mismatch)
- [ ] Fix 44 test files that fail to load (0 tests collected — likely import/setup issues)
- [ ] Clean up deleted `.ralphy-worktrees/` submodule references from git status
- [ ] Commit all 79 uncommitted file changes
- [ ] Push 41 local commits to origin/main
- [ ] Verify: `npx vitest run` — all tests pass
- [ ] Verify: `npx tsc --noEmit` — 0 errors (currently passing)

## S2 — Infrastructure (Mar 17–21)
- [ ] Docker compose production configuration (docker-compose.yml currently modified/uncommitted)
- [ ] Environment setup verification (dual .env: root for Vite frontend, server/ for backend)
- [ ] Redis configuration for production (currently `redis://localhost:6379`)
- [ ] Supabase production project setup (currently dev instance)
- [ ] BullMQ job queue production config
- [ ] FFmpeg availability verification on deploy target
- [ ] Set up platform API credentials (TikTok, YouTube, Instagram, Pexels, Anthropic/OpenAI)
- [ ] Run Supabase migration: `002_add_instagram_support.sql`

## S3 — Beta (Mar 24–Apr 4)
- [ ] Deploy backend to production host (Bun + Hono on port 8787)
- [ ] Deploy frontend to Vercel or hosting provider
- [ ] Beta testing with real Twitch VODs (end-to-end pipeline)
- [ ] Verify chat analysis with live Twitch data
- [ ] Verify face tracking (MediaPipe) on real stream content
- [ ] Verify caption generation (Whisper) with all 5 presets
- [ ] Verify multi-platform export (TikTok, YouTube, Instagram OAuth flows)
- [ ] Pipeline performance benchmarking (processing time per VOD minute)
- [ ] Load testing with concurrent job queue

## S4 — Public Launch (Apr 7–18)
- [ ] Landing page
- [ ] Pricing/monetization strategy
- [ ] Terms of service / privacy policy
- [ ] Public launch announcement
- [ ] Monitoring and alerting setup

---

## Post-Launch
- [ ] Additional platform support (Twitter/X, Facebook)
- [ ] AI model improvements (fine-tuned game detection)
- [ ] Live stream monitoring (real-time clip detection)
- [ ] User analytics dashboard
- [ ] Template marketplace for caption presets
- [ ] Team/collaboration features
- [ ] Mobile app for clip review

---

## Known Blocking Issues

| Issue | Severity | Location |
|-------|----------|----------|
| 44 test files fail to load (0 tests collected) | High | Various — likely vitest config or import issues |
| fusion.test.ts: 7 failing tests | Medium | `server/src/analysis/fusion.test.ts` |
| JobCard.test.tsx: 4 failing tests | Medium | `src/components/queue/JobCard.test.tsx` |
| useAuth.test.ts: 1 failing test | Low | `src/hooks/useAuth.test.ts` |
| VodBrowserModal.test.tsx: label query mismatch | Low | `src/components/queue/VodBrowserModal.test.tsx` |
| 79 uncommitted files in working tree | High | `git status` |
| 41 commits not pushed to origin | High | `git push` needed |
| `.ralphy-worktrees/` deleted submodules in git | Low | Clean up submodule refs |

## Reference

| Doc | Purpose |
|-----|---------|
| `README.md` | Project overview, setup instructions |
| `CHANGELOG.md` | Feature history (Night 1 scaffolding) |
| `ENV_SETUP.md` | Dual .env configuration guide |
| `PRD.yaml` | Product requirements (19 tasks, all completed) |
| `docs/archive/BUILD_PLAN.md` | Original build roadmap (superseded) |
| `docs/archive/RALPHY_EXECUTION_SUMMARY.md` | AI agent execution log (19 features in 170 min) |
| `docs/archive/RALPHY_SETUP.md` | Ralphy agent setup guide |
| `docs/archive/PLAYWRIGHT_TEST_REPORT.md` | Historical E2E test report |
| `docs/timeline-to-release.html` | Visual release timeline |
