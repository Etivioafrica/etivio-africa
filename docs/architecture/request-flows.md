# Request flows

End-to-end paths that cross several layers. The upload, checkout and call flows are documented in their own layers:

- File upload: [07-file-storage.md](07-file-storage.md#upload-pipeline)
- Checkout and fulfilment: [08-payments.md](08-payments.md#fulfilment)
- Coaching call signalling: [11-realtime-calls.md](11-realtime-calls.md#coaching-calls)

## Signed-in page load

```mermaid
sequenceDiagram
  participant B as Browser
  participant P as Proxy (Vercel)
  participant N as Next.js page
  participant S as Supabase
  B->>P: GET /learn (sb-auth cookie)
  P->>S: refresh session if expired
  P->>N: forward with fresh cookies
  N->>N: getClaims() verifies JWT locally (cached JWKS)
  N->>S: queries as the user (RLS applies)
  S-->>N: rows
  N-->>B: streamed HTML + RSC payload
```

## Signed-out public page

```mermaid
sequenceDiagram
  participant B as Visitor or bot
  participant P as Proxy
  participant N as Next.js page
  participant C as Cache Components
  B->>P: GET /courses/...
  P->>P: no sb- cookie, so skip auth client
  P->>N: forward
  N->>C: "use cache" data (about 1 min)
  C-->>N: cached rows, or fresh from Supabase
  N-->>B: HTML
```

## Scheduled reminders

```mermaid
sequenceDiagram
  participant CR as pg_cron (Supabase)
  participant V as Vault
  participant N as /api/cron/* (Vercel)
  participant DB as Postgres
  participant RS as Resend
  CR->>V: read cron_secret
  CR->>N: GET with Bearer cron_secret (every 10 min)
  N->>N: compare with CRON_SECRET
  N->>DB: sendDueReminders() finds due checkouts or sessions
  N->>RS: send reminder emails
```
