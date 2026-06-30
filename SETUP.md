# 🚀 Lead Dispatcher — Setup Guide

**Private cold email automation with inbox rotation, warm-up engine, and unified inbox.**

This file is your one-stop setup guide. Follow it top to bottom.

---

## What You're Building

A self-hosted alternative to Instantly.ai / Smartlead that runs on **free tiers**:

| Component | Platform | Cost |
|-----------|----------|------|
| Frontend | Vercel (free hobby tier) | $0 |
| Backend API | Google Cloud Run ($300 free credit + always-free tier) | $0 |
| Database | Neon Postgres (free 0.5GB) | $0 |
| Background worker | Cloud Run Jobs + Cloud Scheduler | $0 |

**Total monthly cost: $0** (for first 90 days via GCP credit, then ~$0-8/mo on always-free tiers)

---

## Prerequisites

You need:
- A Google account (for GCP + Vercel login)
- A GitHub account
- The two repos (already created for you):
  - **Frontend**: https://github.com/interiorvisualsd-maker/cold-outreach-frontend
  - **Backend**: https://github.com/interiorvisualsd-maker/cold-outreach-backend

---

## Step 1: Create Database (Neon Postgres) — 5 min

1. Go to **https://neon.tech** → Sign up with Google (free, no credit card)
2. Click **"Create Project"** → name it `lead-dispatcher`
3. Select region closest to you (e.g., `us-east-2`)
4. Copy the **connection string** — it looks like:
   ```
   postgresql://lead_dispatcher:abc123xyz@ep-cool-name-123.us-east-2.aws.neon.tech/lead-dispatcher?sslmode=require
   ```
5. Save this somewhere — you'll need it for both repos.

---

## Step 2: Deploy Backend (Google Cloud Run) — 15 min

### 2a. Create a GCP project

1. Go to **https://console.cloud.google.com**
2. Click the project dropdown → **"New Project"** → name it `lead-dispatcher`
3. You'll get **$300 free credit** valid for 90 days

### 2b. Enable APIs

In the GCP console, enable these APIs (search for each):
- **Cloud Run API**
- **Cloud Build API**
- **Cloud Scheduler API**
- **Artifact Registry API**

### 2c. Clone & push the backend repo

```bash
git clone https://github.com/interiorvisualsd-maker/cold-outreach-backend.git
cd cold-outreach-backend
```

### 2d. Deploy to Cloud Run

```bash
# Install gcloud CLI: https://cloud.google.com/sdk/docs/install
gcloud auth login
gcloud config set project lead-dispatcher

# Deploy the API
gcloud run deploy cold-outreach-api \
  --source . \
  --region us-central1 \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --allow-unauthenticated \
  --set-env-vars "DATABASE_URL=PASTE_YOUR_NEON_CONNECTION_STRING" \
  --set-env-vars "JWT_SECRET=$(openssl rand -hex 32)" \
  --set-env-vars "ENCRYPTION_KEY=$(openssl rand -hex 32)" \
  --set-env-vars "FRONTEND_URL=https://cold-outreach-frontend.vercel.app" \
  --set-env-vars "PUBLIC_BASE_URL=https://cold-outreach-frontend.vercel.app"
```

This takes 3-5 minutes. When done, you'll get a URL like:
```
https://cold-outreach-api-xxxxx-uc.a.run.app
```
**Save this URL** — you need it for the frontend.

### 2e. Initialize the database

```bash
# Run Prisma migration against your Neon database
export DATABASE_URL="PASTE_YOUR_NEON_CONNECTION_STRING"
npx prisma db push
npx prisma generate
```

### 2f. Set up the background worker (Cloud Run Job + Scheduler)

```bash
# Create the worker job
gcloud run jobs create cold-outreach-worker \
  --source . \
  --region us-central1 \
  --command "bun" --args "src/worker-job.ts" \
  --set-env-vars "DATABASE_URL=PASTE_YOUR_NEON_CONNECTION_STRING" \
  --set-env-vars "JWT_SECRET=SAME_AS_ABOVE" \
  --set-env-vars "ENCRYPTION_KEY=SAME_AS_ABOVE"

# Schedule it to run every 5 minutes
gcloud scheduler jobs create http cold-outreach-worker-trigger \
  --schedule "*/5 * * * *" \
  --uri "https://cold-outreach-api-xxxxx-uc.a.run.app/api/dispatcher/process" \
  --http-method POST \
  --oauth-service-account-email $(gcloud projects describe lead-dispatcher --format="value(projectNumber)")@cloudbuild.gserviceaccount.com
```

---

## Step 3: Deploy Frontend (Vercel) — 5 min

### 3a. Clone the frontend repo

```bash
git clone https://github.com/interiorvisualsd-maker/cold-outreach-frontend.git
cd cold-outreach-frontend
```

### 3b. Deploy on Vercel

1. Go to **https://vercel.com** → Sign in with GitHub
2. Click **"Add New Project"** → Import `cold-outreach-frontend`
3. Framework preset: **Next.js** (auto-detected)
4. Under **"Environment Variables"**, add:
   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_API_URL` | `https://cold-outreach-api-xxxxx-uc.a.run.app` (your Cloud Run URL from Step 2d) |
5. Click **"Deploy"** → wait 2-3 minutes
6. You'll get a URL like: `https://cold-outreach-frontend.vercel.app`

### 3c. Update backend CORS

Go back to Cloud Run → your `cold-outreach-api` service → **"Edit & Deploy New Revision"** → update the `FRONTEND_URL` env var to your Vercel URL:
```
FRONTEND_URL=https://cold-outreach-frontend.vercel.app
```

---

## Step 4: Create Your First User — 1 min

1. Visit your Vercel URL: `https://cold-outreach-frontend.vercel.app`
2. Click **"Sign up"**
3. Enter your name, email, password
4. You're in! The first user is automatically the admin.

---

## Step 5: Optional — Enable DeepSeek LLM for Reply Sentiment

The app can auto-classify replies as "interested", "not_interested", "ooo", or "unsubscribe" using DeepSeek.

1. Get an API key at **https://platform.deepseek.com** (very cheap, ~$0.14/M tokens)
2. In Cloud Run, add env var:
   ```
   DEEPSEEK_API_KEY=sk-your-deepseek-key
   ```
3. Redeploy the backend

---

## Architecture

```
┌─────────────────────────────────────────┐
│  Vercel (Frontend)                      │
│  Next.js 16 + TypeScript + Tailwind 4   │
│  URL: cold-outreach-frontend.vercel.app │
└──────────────────┬──────────────────────┘
                   │ HTTPS + JWT
                   ▼
┌─────────────────────────────────────────┐
│  Cloud Run (Backend API)                │
│  Hono on Bun                            │
│  URL: cold-outreach-api-xxxx.a.run.app  │
│  Scales 0→3 instances                   │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  Neon Postgres (shared)                 │
│  All state: accounts, leads, queue,     │
│  warmup, replies, suppression           │
└─────────────────────────────────────────┘
                   ▲
                   │ triggers every 5 min
┌──────────────────┴──────────────────────┐
│  Cloud Scheduler → Cloud Run Job        │
│  (Worker: sends emails, polls IMAP,     │
│   runs warmup, sequence breaker)        │
└─────────────────────────────────────────┘
```

---

## Features

- ✅ **SMTP/IMAP Account Manager** — connect unlimited sending accounts with encrypted credentials
- ✅ **Inbox Rotation** — round-robin sending with 50-100/day + hourly caps, auto-pause on failures
- ✅ **Warm-up Engine** — peer-to-peer warmup with spam-folder rescue, auto-reply, ramp-up scheduler
- ✅ **Campaign Builder** — 3-step email sequences with merge fields
- ✅ **CSV Import** — any filename, fuzzy column auto-detection, dedup, suppression check
- ✅ **Unibox** — unified reply inbox with thread view, sentiment filtering, manual reply
- ✅ **Sequence Breaking** — auto-cancel follow-ups when a lead replies
- ✅ **Open/Click Tracking** — tracking pixel + link wrapping
- ✅ **CAN-SPAM Compliant** — unsubscribe footer + suppression list
- ✅ **Analytics** — deliverability score, 7-day trends, sentiment breakdown
- ✅ **Templates** — reusable email templates with merge fields
- ✅ **Team Management** — multi-user with admin/member roles
- ✅ **Notifications** — in-app alert center for replies, bounces, failures
- ✅ **DeepSeek LLM** — AI reply sentiment tagging (optional)

---

## Local Development

```bash
# Frontend
cd cold-outreach-frontend
bun install
cp .env.example .env.local
# Edit .env.local: NEXT_PUBLIC_API_URL=http://localhost:3001
bun run dev  # runs on port 3000

# Backend (separate terminal)
cd cold-outreach-backend
bun install
cp .env.example .env
# Edit .env: DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY
bun run db:push
bun run dev  # runs on port 3001
```

---

## Troubleshooting

**"Failed to fetch" on frontend**
→ Check `NEXT_PUBLIC_API_URL` is set correctly in Vercel env vars
→ Check `FRONTEND_URL` is set correctly in Cloud Run env vars (CORS)

**"Unauthorized" on API calls**
→ Your JWT may have expired. Log out and log back in.

**Database connection errors**
→ Verify `DATABASE_URL` has `?sslmode=require` at the end (Neon requires SSL)

**Worker not running**
→ Check Cloud Scheduler is enabled
→ Check the service account has `roles/run.invoker` permission

**SMTP sending fails**
→ Verify your SMTP credentials (use app passwords for Gmail, not your regular password)
→ Check your provider allows SMTP access

---

## Cost Breakdown (After 90-Day Free Credit)

| Component | Always-Free Tier | Your Usage | Cost |
|-----------|-----------------|------------|------|
| Vercel | Hobby: free | Static Next.js | $0 |
| Cloud Run API | 240k vCPU-sec + 450k GiB-sec/mo | ~5% of free tier | $0 |
| Cloud Run Worker | Same free tier | ~10% | $0 |
| Cloud Scheduler | 3 jobs free | 1 job | $0 |
| Neon Postgres | 0.5GB free | <100MB | $0 |
| **Total** | | | **$0/mo** |

Optional: Cloud NAT for static sending IP (~$33/mo) — recommended for production cold email deliverability.

---

## Support

- Full code: https://github.com/interiorvisualsd-maker/cold-outreach-frontend + cold-outreach-backend
- Detailed deployment: see `DEPLOYMENT.md` in this repo
- Worklog: see `worklog.md` for development history
