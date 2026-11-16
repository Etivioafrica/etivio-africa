<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Commits and pull requests by AI agents

- Do not add yourself as an author or contributor. No `Co-Authored-By:` trailers, no "Generated with ..." lines, and no agent or tool attribution in commit messages, PR titles or PR descriptions.
- Commits go out under the human collaborator's own git identity (`user.name` / `user.email`). Don't change it.

## Architecture docs

- `docs/architecture/` holds the architecture as plain Markdown, one file per layer, indexed in `docs/architecture/README.md`.
- When you change code, update the doc for each layer you touched in the same piece of work, and bump the README's "Last verified against" line. New routes, tables, env vars, feature flags, outside services and cron jobs always need a doc update.
- `docs/architecture/` is committed (the rest of `docs/` stays gitignored). Put doc updates in the same commit or PR as the code change.
