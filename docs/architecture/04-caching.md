# 4 · Caching

**Source of truth:** `next.config.ts` (`cacheComponents`, `partialPrefetching`) and every `"use cache"`, `cacheLife`, `cacheTag`, `updateTag` call site

The app uses Next 16 **Cache Components**. Anything marked `"use cache"` is prerendered and reused; everything else renders per request. **Partial prefetching** is also on.

## Current cache rules

| What | How | Freshness |
|------|-----|-----------|
| Public page data | `"use cache"` + `cacheLife("minutes")` | About 1 minute |
| Public blog list | `cacheTag("blog")` + custom `cacheLife` | Up to 1 hour; ends early when the next scheduled post is due |
| Blog changes from admin | `updateTag("blog")` (12 call sites) | Cleared at once |
| Per-request user | React `cache()` on `getCurrentUser` | De-duplicated within one request |

## Rules for new code

- Session reads go through `createClient()` in `src/lib/supabase/server.ts`, which calls `connection()` first so per-user data never ends up in a shared prerender.
- Don't put user-specific data inside a `"use cache"` scope.
- When you add a cached read that admins can change, give it a tag and call `updateTag` from the admin action, the same way the blog does.

At this snapshot, 6 files use `"use cache"`.
