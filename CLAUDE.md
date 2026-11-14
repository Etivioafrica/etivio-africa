@AGENTS.md

# Working together on this repo

Several people (and their AI agents) work in this repo at once. These rules are here to stop branch conflicts, migration-number clashes and accidental production changes. Follow them in every session.

## Branches

- `main` is protected. Never commit or push to it directly. Every change goes in through a pull request.
- One branch per task. Branch from an up-to-date `main` and name it after the work: `feat/<topic>`, `fix/<topic>`, `perf/<topic>` or `chore/<topic>`.
- Before starting work, and again before opening a PR:
  ```
  git fetch origin
  git switch main && git pull --ff-only
  git switch <your-branch> && git rebase origin/main
  ```
- Keep branches short-lived and PRs small. A branch that lives for days is where conflicts come from.
- Don't rewrite history on a branch someone else is also using. On your own branch, use `git push --force-with-lease` after a rebase, never `--force`.
- Don't reformat or reorder files you aren't otherwise changing. Drive-by edits cause conflicts in other people's branches.

## Database migrations (`supabase/migrations/`)

Files are numbered in sequence: `NNNN_short_name.sql` (the latest is `0061_projects.sql`). Two branches that pick the same number will clash.

To claim a number:
1. Run `git fetch origin`, then find the highest number on `origin/main` **and** on open PRs.
2. Take the next number, commit the migration file, and push your branch / open a draft PR straight away so others can see the number is taken.
3. If someone else's migration with the same number merges first, renumber yours to the next free number before you merge. Whoever merges second renumbers.

Never edit a migration that has already merged to `main`. Write a new one instead.

## Production

- **Never apply migrations to the production database, change production env vars, or trigger production deploys without the project owner's explicit OK.** That rule applies to AI agents too, even when they have the credentials.
- Never commit secrets. `.env*` files are gitignored, so keep them that way.

## Files that conflict often

- `src/lib/database.types.ts` is generated. Don't hand-merge conflicts in it. Take either side, then regenerate it after the migrations merge (see `scripts/gen-types.py`).
- `package-lock.json`: don't hand-merge it either. Take `main`'s version, then run `npm install` to re-add your dependencies.
- `AGENTS.md` is rewritten by `next dev`. Commit its changes rather than reverting them.

## Before opening a PR

- `npm run lint` and `npm run build` pass.
- Rebased on the latest `origin/main`, with no merge commits from `main` in your branch.
- The PR description says what changed, and lists any migration with its number.
