# Cold Outreach Frontend

Private cold email automation — frontend (Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui).

Deployed on **Vercel**. Calls the [Cold Outreach Backend](https://github.com/interiorvisualsd-maker/cold-outreach-backend) running on Google Cloud Run.

## Quick Start (Local Dev)

```bash
# 1. Install dependencies
bun install   # or: npm install

# 2. Set the backend URL
cp .env.example .env.local
# Edit .env.local — set NEXT_PUBLIC_API_URL to your backend URL

# 3. Run dev server
bun run dev   # or: npm run dev
# Open http://localhost:3000
```

## Features

- **Dashboard** — Overview stats, account health, campaign summary
- **Sending Accounts** — SMTP/IMAP account manager with test + warm-up config
- **Campaigns** — Create campaigns, define 3-step email sequences, view leads
- **Import CSV** — Upload any CSV (any filename), auto-detect columns, map fields, import with dedup
- **Dispatcher** — Queue monitor, sending stats, manual process trigger
- **Warm-up Engine** — Peer-to-peer warm-up status, ramp-up progress, spam rescue stats
- **Unibox** — Unified reply inbox with thread view and manual reply composer

## Tech Stack

- Next.js 16 (App Router)
- TypeScript 5
- Tailwind CSS 4
- shadcn/ui (New York style)
- Recharts (analytics)
- Lucide icons

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import this repo
3. Set environment variable: `NEXT_PUBLIC_API_URL` = your Cloud Run backend URL
4. Deploy

See `DEPLOYMENT.md` in the main project for full instructions.

## Related

- **Backend repo**: https://github.com/interiorvisualsd-maker/cold-outreach-backend
- **Deployment guide**: See `DEPLOYMENT.md`
