# Deployment Guide — Two-Repo Split

This app is designed to deploy as **two separate GitHub repositories**:

| Repo | Hosts | Contents |
|------|-------|----------|
| `lead-dispatcher-frontend` | Vercel | `src/` (Next.js app) |
| `lead-dispatcher-backend` | Google Cloud Run | `mini-services/backend/` (Hono API + worker) |

Both share a **Neon Postgres** database.

---

## 1. Database: Neon Postgres (Free Tier)

1. Go to [neon.tech](https://neon.tech) → sign up (free, no credit card)
2. Create a project → copy the connection string
   - Looks like: `postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`
3. This is your `DATABASE_URL` for both repos

---

## 2. Backend Repo → Google Cloud Run

### Step 1: Create the repo
```bash
mkdir lead-dispatcher-backend
cp -r /path/to/mini-services/backend/* lead-dispatcher-backend/
cd lead-dispatcher-backend
git init && git add -A && git commit -m "initial backend"
# Push to GitHub:
gh repo create lead-dispatcher-backend --private --source=. --push
```

### Step 2: Switch Prisma to Postgres
Edit `prisma/schema.prisma` (copy it from the main project's `prisma/` folder):
```prisma
datasource db {
  provider = "postgresql"    // was "sqlite"
  url      = env("DATABASE_URL")
}
```
Then run:
```bash
npx prisma db push    # creates all tables in Neon
npx prisma generate
```

### Step 3: Add Dockerfile for Cloud Run
Create `Dockerfile` in the backend repo:
```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile || bun install
COPY . .
RUN bunx prisma generate
EXPOSE 3001
CMD ["bun", "src/server.ts"]
```

### Step 4: Deploy to Cloud Run
```bash
# Set project
gcloud config set project YOUR_GCP_PROJECT

# Build & deploy (uses $300 free credit)
gcloud run deploy lead-dispatcher-api \
  --source . \
  --region us-central1 \
  --port 3001 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --allow-unauthenticated \
  --set-env-vars "DATABASE_URL=postgresql://..." \
  --set-env-vars "JWT_SECRET=your-strong-secret" \
  --set-env-vars "ENCRYPTION_KEY=your-32-byte-key" \
  --set-env-vars "FRONTEND_URL=https://your-app.vercel.app" \
  --set-env-vars "PUBLIC_BASE_URL=https://your-app.vercel.app"
```

Cloud Run gives you a URL like: `https://lead-dispatcher-api-xxxx-uc.a.run.app`

### Step 5: Set up Cloud Scheduler (replaces in-process worker)
In production, the worker should run as a Cloud Run Job triggered by Cloud Scheduler:

```bash
# Create a Cloud Run Job
gcloud run jobs create lead-dispatcher-worker \
  --image gcr.io/YOUR_PROJECT/lead-dispatcher-api \
  --command "bun" --args "src/worker-job.ts" \
  --set-env-vars "DATABASE_URL=..." \
  --tasks 1

# Schedule it every 5 minutes
gcloud scheduler jobs create http lead-dispatcher-worker-trigger \
  --schedule "*/5 * * * *" \
  --uri "https://lead-dispatcher-api-xxxx-uc.a.run.app/api/dispatcher/process" \
  --http-method POST \
  --oidc-service-account-email YOUR_SA@YOUR_PROJECT.iam.gserviceaccount.com
```

---

## 3. Frontend Repo → Vercel

### Step 1: Create the repo
```bash
mkdir lead-dispatcher-frontend
cp -r /path/to/src lead-dispatcher-frontend/
cp package.json lead-dispatcher-frontend/
cp next.config.ts lead-dispatcher-frontend/
cp tsconfig.json lead-dispatcher-frontend/
cp tailwind.config.ts lead-dispatcher-frontend/
cp postcss.config.mjs lead-dispatcher-frontend/
cp components.json lead-dispatcher-frontend/
cp -r public lead-dispatcher-frontend/
cp -r prisma lead-dispatcher-frontend/  # needed for prisma generate at build
cd lead-dispatcher-frontend
git init && git add -A && git commit -m "initial frontend"
gh repo create lead-dispatcher-frontend --private --source=. --push
```

### Step 2: Remove the catch-all API route
Delete `src/app/api/[...path]/route.ts` — in production, the frontend calls the Cloud Run backend directly (not in-process).

### Step 3: Import Vercel on GitHub
1. Go to [vercel.com](https://vercel.com) → New Project → import `lead-dispatcher-frontend`
2. Framework preset: Next.js
3. Add environment variables:
   - `NEXT_PUBLIC_API_URL` = `https://lead-dispatcher-api-xxxx-uc.a.run.app`
   - `DATABASE_URL` = your Neon connection string (for Prisma generate at build time)
4. Deploy → get URL like `https://lead-dispatcher.vercel.app`

### Step 4: Update backend CORS
Go back to Cloud Run, update the backend's env:
```
FRONTEND_URL=https://lead-dispatcher.vercel.app
```

---

## 4. Cost Estimate

| Component | Free Tier | Your Usage | Monthly Cost |
|-----------|-----------|------------|--------------|
| **Vercel** (frontend) | Hobby: free | Static Next.js | $0 |
| **Cloud Run** (API) | 240k vCPU-sec + 450k GiB-sec free | ~5% of free tier | $0 |
| **Cloud Run Jobs** (worker) | Same free tier | ~10% of free tier | $0 |
| **Cloud Scheduler** | 3 jobs free | 1 job | $0 |
| **Neon Postgres** | 0.5GB free | <100MB | $0 |
| **GCP $300 credit** | 90 days | Covers any overage | $0 for 3 months |
| **After 90 days** | Always-free tiers | Still within free tier | **~$0–$8/mo** |

**Optional Cloud NAT** (recommended for cold email deliverability — gives you a static IP): ~$33/mo. Not covered by free tier after credit expires.

---

## 5. Architecture Diagram (Production)

```
┌─────────────────────────────────┐
│  Vercel (Frontend)              │
│  Next.js static + client React  │
│  ────────────────────────────   │
│  Calls: https://api.a.run.app   │
└──────────────┬──────────────────┘
               │ HTTPS + JWT
               ▼
┌─────────────────────────────────┐
│  Cloud Run (Backend API)        │
│  Hono on Bun                    │
│  ────────────────────────────   │
│  /api/auth, /api/accounts, ...  │
│  Scales 0→3 instances           │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Neon Postgres                  │
│  Shared by API + Worker         │
│  500MB free → scales as needed  │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  Cloud Scheduler (every 5 min)  │
│  ────────────────────────────   │
│  Triggers Cloud Run Job:        │
│  → Send campaign emails         │
│  → Send warm-up emails          │
│  → IMAP poll (replies + spam)   │
│  → Sequence breaker             │
└─────────────────────────────────┘
```

---

## 6. Sandbox vs Production Differences

| Aspect | Sandbox | Production |
|--------|---------|------------|
| Backend process | In-process (Next.js API route) | Standalone (Cloud Run) |
| Worker | `setInterval` in Next.js | Cloud Run Job + Scheduler |
| Database | SQLite (`db/custom.db`) | Neon Postgres |
| Frontend API calls | Same-origin `/api/*` | Cross-origin to Cloud Run URL |
| `NEXT_PUBLIC_API_URL` | empty (same origin) | `https://api.a.run.app` |
| Env vars | `.env` file | Cloud Run + Vercel dashboards |

The code is **identical** — only config differs. The `app.ts` Hono app and all modules (`dispatcher.ts`, `warmup.ts`, `unibox.ts`) run unchanged in both environments.
