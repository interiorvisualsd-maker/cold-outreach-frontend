import { NextRequest } from 'next/server'
import app from '../../../../mini-services/backend/src/app'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Catch-all API route — delegates all /api/* requests to the Hono backend app.
// In production (Cloud Run), this same app.ts runs as a standalone Bun server.
// In the sandbox, it runs in-process inside Next.js to avoid background-process
// reaping issues.
//
// NOTE: The background worker (send queue, warmup, IMAP polling) is intentionally
// NOT started in the sandbox — it was causing process crashes. In production,
// the worker runs as a separate Cloud Run Job (worker-job.ts). For sandbox
// testing, use the manual trigger buttons in the Dispatcher/Warmup/Unibox views.
async function handler(req: NextRequest) {
  const url = new URL(req.url)
  const honoReq = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
    // @ts-ignore - duplex is needed for streaming bodies in Node
    duplex: 'half',
  })

  const res = await app.fetch(honoReq)
  return res
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as DELETE,
  handler as PATCH,
  handler as OPTIONS,
}
