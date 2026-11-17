# Scaling notes (parked)

> **Parked until a measured bottleneck.** Don't act on this plan until the team hits a real limit, seen in dashboards, errors or user complaints. Kept for reference only.

**Status:** Parked (17 Nov 2026). Nothing here is built, and all numbers are estimates until there's a load test against a separate database.
**Plans assumed:** Vercel Pro + Supabase Pro, Supabase defaults (spend cap on, Micro database) unless a row says otherwise.
**Source of truth:** `src/components/learn/LessonVideo.tsx`, `src/app/(app)/learn/course-actions.ts`, `src/components/shell/HeaderInbox.tsx`, `src/lib/supabase/realtime.ts`, `src/app/api/t/route.ts`

## How load reaches the app today

| Visitor | Cost to Etivio | Notes |
|---------|----------------|-------|
| Learner watching a YouTube lesson | 1 page load per lesson, then 1 progress save per ~30 s of new playback | Video bytes come from YouTube, not Vercel or Supabase. The player opens no Realtime connection |
| Signed-in user browsing the app | Server render per page (several reads) + 1 visit-tracking RPC + **1 Realtime connection per tab** | The connection comes from the header inbox (`HeaderInbox.tsx`) |
| Signed-out visitor | Mostly cached pages (~1 min), no auth client | Cheap |

Each progress save (`course-actions.ts:100-114`) runs **5 queries**: 3 checks (lesson, course, enrolment), 1 read of current progress and 1 upsert. The browser sends a save after every 30 new seconds watched, and on pause, end and leaving the page (`LessonVideo.tsx`).

## Limits, in the order we'd hit them

| # | Limit | Ceiling | What happens past it |
|---|-------|---------|----------------------|
| 1 | Supabase Realtime connections (one per signed-in tab outside the player) | 500 on Pro with spend cap on · 10,000 with it off | Pages still work; notifications, messages, Campus and support stop updating live |
| 2 | Database size: Micro handles roughly 500 queries/s sustained (estimate) | Grows with Small / Medium | Every page gets slower |
| 3 | Realtime fan-out: the inbox listens to the whole `conversations` table unfiltered, and staff listen to all `support_threads`. Supabase checks each change against each listener's access rules, one change at a time | Strains at a few thousand connected users who are chatting | Live updates lag; extra database load |
| 4 | Vercel burst limit: 1,000 new function instances per 10 s per region (30,000 running at once overall) | Spikes, such as a live class all opening a lesson at once | `503 FUNCTION_THROTTLED` |

## Current capacity estimate

| Supabase setup | Browsing (signed-in) | Watching lessons | Realistic total |
|----------------|----------------------|------------------|-----------------|
| Spend cap on, Micro (defaults) | ~500 | ~3,000–4,000 | **~1,500–2,500** |
| Spend cap off, Micro | ~1,500 | ~3,000–4,000 | ~2,500–4,000 |
| Spend cap off, Small / Medium | ~3,000–5,000 | ~10,000+ | ~5,000–10,000 |

## Proposal: batch progress saves through a queue

A queue mainly helps people watching lessons. Browsing is mostly reads the page needs straight away, so a queue barely changes it. Caching and Realtime fixes are what help browsing.

| Queue | Database work per save | Watching capacity (Micro) |
|-------|------------------------|---------------------------|
| None (today) | 5 queries | ~3,000–4,000 |
| **Supabase Queues (pgmq)**, drained in bulk by pg_cron | 1 small insert, then bulk processing | ~8,000–10,000 |
| **Redis outside the database** (for example Upstash through Vercel), bulk-flushed by a cron route | ~0 per save; about 4 queries per batch of a few hundred | ~15,000–20,000 in theory, ~10,000–15,000 in practice |

### Capacity with each change (Pro + Pro, Micro)

| Scenario | Browsing | Watching | Realistic total |
|----------|----------|----------|-----------------|
| Today | ~500 | ~3,000–4,000 | **~1,500–2,500** |
| + queue (pgmq) | ~500 | ~8,000–10,000 | **~4,000–6,000** |
| + queue (Redis) | ~500 | ~10,000–15,000 | **~6,000–9,000** |
| + Redis queue, spend cap off, filtered Realtime | ~1,500–2,000 (now limited by database reads) | ~10,000–15,000 | **~10,000–15,000** |

### What a queue doesn't change

- The 500 Realtime connection limit, while the spend cap is on.
- The number of Vercel requests: each save still calls a function. Sending saves less often from the browser is what reduces those.

### Design constraint: the Complete button

The database refuses lesson completion until enough of the video has been watched (`lesson_watch`), and the Complete button reads the save's immediate reply. If every save were queued, the button would lag by the batching interval. So:

- **Queue** the saves sent during playback, which is about 95% of them.
- **Keep the save synchronous** on pause, at the end of the video, and when the learner is close to the "watched enough" threshold.

## Recommended order

| Step | Change | Effect | Effort |
|------|--------|--------|--------|
| 1 | Send progress saves every 60 s instead of 30 s (`pending.current >= 60` in `LessonVideo.tsx`) | Halves database and Vercel load from people watching | One line |
| 2 | Supabase Queues (pgmq) for mid-playback saves, with a pg_cron worker doing bulk checks and a bulk upsert | ~3× watching capacity, no new vendor | Migration + worker + split sync/async paths |
| 3a | Close Realtime channels in hidden tabs (`realtime.ts` / `HeaderInbox.tsx`) | Roughly halves connections in use | Small |
| 3b | Filter the inbox's `conversations` listener to the user's own conversations, or move the inbox to Broadcast | Removes the fan-out limit (#3) | Small to medium |
| 3c | Turn off the Supabase spend cap | Realtime limit 500 → 10,000 (~$10 per extra 1,000 at peak) | Dashboard setting |
| 4 | Upgrade the database Micro → Small / Medium | 2–4× database headroom | Dashboard setting, extra cost |
| 5 | Move the queue to Redis | Only if regularly above ~8,000 people at once | New service |
| — | Load test with k6 against a preview deployment and a **separate** database | Replaces these estimates with measured numbers | Medium |

## References

- [Supabase Realtime limits](https://supabase.com/docs/guides/realtime/limits)
- [Supabase Realtime pricing](https://supabase.com/docs/guides/realtime/pricing)
- [Supabase Realtime peak connections](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-peak-connections)
- [Vercel Functions limits](https://vercel.com/docs/functions/limitations)
- [Vercel concurrency scaling](https://vercel.com/docs/functions/concurrency-scaling)
