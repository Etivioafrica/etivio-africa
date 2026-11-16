# 13 · Feature flags

**Source of truth:** `src/lib/features.ts`, `src/lib/data/features.ts`, the `feature_flags` table (migration 0046)

Every feature that can be turned off, or launched to staff first, has a flag. Admins change flags in **Settings → Features**. A flag that has never been changed uses its `initial` value from code.

| Status | Meaning |
|--------|---------|
| `off` | Hidden from everyone |
| `staff` | Visible to staff only (trial launch) |
| `on` | Visible to everyone |

## Flags

| Key | Default | Controls |
|-----|---------|----------|
| `group_buy` | on | Buying a course with friends at a discount. When off, open groups still finish |
| `wallet` | on | Wallet page and Paystack top-ups. Existing balances still work at checkout |
| `messages` | on | Student–tutor chat and the Messages inboxes |
| `ai_assistant` | on | Floating AI helper in the app |
| `ai_course_tools` | on | AI help when creating courses and products |
| `ai_lesson` | on | Ask AI tab in the player |
| `referrals` | on | Invite links and wallet rewards. When off, links still work but nobody earns |
| `withdrawals` | on | Tutor payout requests |
| `campus` | on | Shared learner feed |
| `coaching` | **off** | Coach profiles, booking, paid sessions, calls |
| `communities` | **off** | Community spaces (coming soon) |

When you add a flag, add it to `FEATURES` in `src/lib/features.ts` and to this table.
