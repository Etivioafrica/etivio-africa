This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Requirements: Node.js 20+ (tested on 24) and npm.

```bash
npm ci                      # install exact versions from package-lock.json
cp .env.example .env.local  # then fill in the values (ask the project owner for dev keys)
npm run dev                 # http://localhost:3010
```

At minimum `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` must be set, or data-backed pages fail with "supabaseUrl is required". Variables marked optional in `.env.example` only switch on extra features.

Use `npm ci`, not `npm install`, unless you're adding a dependency, so `package-lock.json` doesn't churn between machines. See `CLAUDE.md` for branch and migration rules.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
