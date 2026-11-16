# 10 · AI & moderation

**Source of truth:** `src/lib/ai.ts`, `src/lib/ai-writer.ts`, `src/lib/moderation.ts`, `src/app/api/ai/*`, `src/app/(app)/teach/ai-actions.ts`
**Services:** Cloudflare Workers AI, Firecrawl (optional)

All AI calls go through `src/lib/ai.ts`, so changing provider means changing that file only. `aiConfigured()` is false when `CLOUDFLARE_ACCOUNT_ID` or `CLOUDFLARE_AI_TOKEN` is missing, and every AI feature then switches itself off.

## Models

| Use | Model | Limits and gates |
|-----|-------|------------------|
| Ask AI in lessons | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 40 questions / 24 h · flag `ai_lesson` |
| Etivio AI assistant widget | same | 30 questions / 24 h · flag `ai_assistant` |
| Tutor writing tools (outlines, descriptions, lesson notes) | `@cf/openai/gpt-oss-120b` | flag `ai_course_tools` |
| Course cover generation | `@cf/black-forest-labs/flux-1-schnell` | resized with sharp to 1600×900 WebP |
| Text moderation | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | feeds the moderation queue |
| Image screening at upload | `@cf/meta/llama-3.2-11b-vision-instruct` | 15 s timeout |

Chat replies are streamed as plain text and saved when finished (the AI messages table, migration 0040).

## AI writer web research

`ai-writer.ts` can pull web context through Firecrawl when `FIRECRAWL_API_KEY` is set. Without the key it returns no research and carries on.

## Moderation

- Uploaded images are shrunk to 384 px and checked by the vision model:
  - `explicit`: blocked, a `moderation_flags` row is created with status `blocked`, and the uploader gets a strike.
  - `suggestive`: refused with a message, and flagged.
- Posts, messages, reviews and profiles can be reported by people or caught automatically. Both land in the same queue in **Admin → Moderation** (super admin and reviewer).
- Strikes can lead to suspension; suspended users are sent to `/suspended`.
