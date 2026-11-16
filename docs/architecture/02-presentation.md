# 2 · Presentation

**Source of truth:** `src/app/**` (pages and layouts), `src/components/`, `src/app/globals.css`

## Route groups

The App Router is organised into route groups. Each has its own layout and shell; the brackets don't appear in URLs.

| Group | Who it's for | Main routes |
|-------|--------------|-------------|
| `(public)` | Everyone, indexed by search engines | explore, courses, products, blog, tutors, coaches, groups, projects, cart, checkout, certificate, help, contact, home-1, `/u/[username]` |
| `(home2)` | Marketing | about, tour, teach-on-etivio, home-2 |
| `(auth)` | Signed-out visitors | login, signup, verify, forgot-password, reset-password, set-password |
| `(app)` | Signed-in learners and creators | learn (library, browse, explore, saved, wallet, sessions, messages, projects, invite, faq, announcements), teach (courses, products, earnings, students, messages, projects, coaching), campus, communities, messages, me, profile, roles, settings, support |
| `(player)` | Learners inside a course | full-screen lesson player under `/learn/…` |
| `(call)` | Coach and learner | `/sessions/[id]` video call room |
| `admin` | Staff | `(auth)` login; `(panel)`: dashboard, users, team, courses, review, moderation, marketplace, group-buys, coupons, financials, wallets, referrals, blog, announcements, documents, emails, course-messages, chats, coaching, communities, tracking, charts, ai, settings |
| `(legal)` | Everyone | terms, privacy, refund-policy |

Standalone routes: `auth/callback` and `auth/confirm` (Supabase auth returns), `checkout/cancelled`, `checkout/resume`, `r/[code]` (invite links), `welcome`, `suspended`, `offline`, plus `not-found.tsx`, `opengraph-image.tsx`, `robots.ts` and `sitemap.ts`.

## Components (`src/components`)

| Folder | Contents |
|--------|----------|
| `shell` | App frame, navigation, headers |
| `dash` | Dashboard widgets |
| `learn` | Course cards, player pieces |
| `market` | Marketplace and explore (for example `ExploreResults.tsx`) |
| `chat` | Messages UI |
| `coaching` | `BookingPanel`, `CallRoom`, `CoachEditor`, `SessionList` |
| `moderation` | Report and flag UI |
| `pwa` | Install prompt, service worker registration |
| `analytics` | `VisitTracker` |
| `faq`, `fx` | FAQ blocks, visual effects |

## UI libraries

- **Styling:** Tailwind CSS v4 through the `@tailwindcss/turbopack` loader (configured in `next.config.ts`).
- **Icons:** `lucide-react`.
- **Rich text:** TipTap 3 (starter kit, colour, highlight, image, link, text style, YouTube).
- **Email designer:** `react-email-editor` (admin email templates).
- **HTML safety:** `sanitize-html` for user-supplied rich text (`src/lib/sanitize.ts`).
