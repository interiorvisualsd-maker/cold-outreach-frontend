'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Zap, CheckCircle2, AlertCircle, Loader2, MailX } from 'lucide-react'

interface LeadInfo {
  id: string
  email: string
  companyName: string | null
  alreadyUnsubscribed: boolean
}

export default function UnsubscribePage() {
  const params = useParams()
  const leadId = params.leadId as string
  const [lead, setLead] = useState<LeadInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unsubscribing, setUnsubscribing] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!leadId) return
    fetch(`/api/extras/unsubscribe/${leadId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Invalid link')
        return res.json()
      })
      .then((data) => {
        setLead(data.lead)
        if (data.lead.alreadyUnsubscribed) setDone(true)
      })
      .catch((e) => setError(e.message || 'Invalid unsubscribe link'))
      .finally(() => setLoading(false))
  }, [leadId])

  const handleUnsubscribe = async () => {
    setUnsubscribing(true)
    try {
      const res = await fetch(`/api/extras/unsubscribe/${leadId}`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to unsubscribe')
      setDone(true)
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    } finally {
      setUnsubscribing(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-sm">
            <Zap className="h-5 w-5" fill="currentColor" />
          </div>
          <span className="text-lg font-bold text-slate-900">Lead Dispatcher</span>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          {loading ? (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-8 w-8 text-violet-600 animate-spin mb-4" />
              <p className="text-sm text-slate-500">Loading...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center text-center py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 mb-4">
                <AlertCircle className="h-6 w-6 text-rose-600" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 mb-2">Invalid Link</h1>
              <p className="text-sm text-slate-500">{error}</p>
            </div>
          ) : done ? (
            <div className="flex flex-col items-center text-center py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 mb-4">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 mb-2">You're Unsubscribed</h1>
              <p className="text-sm text-slate-500 mb-6">
                {lead?.email && (
                  <><span className="font-medium text-slate-700">{lead.email}</span><br /></>
                )}
                You will no longer receive emails from us. This change takes effect immediately.
              </p>
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 w-full">
                <p className="text-xs text-slate-500 text-center">
                  You can close this page now.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 mb-4">
                <MailX className="h-6 w-6 text-amber-600" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 mb-2">Unsubscribe</h1>
              <p className="text-sm text-slate-500 mb-1">
                Confirm removal for
              </p>
              <p className="text-sm font-medium text-slate-700 mb-6">
                {lead?.email}
                {lead?.companyName && <span className="text-slate-500"> · {lead.companyName}</span>}
              </p>
              <div className="space-y-3 w-full">
                <button
                  onClick={handleUnsubscribe}
                  disabled={unsubscribing}
                  className="w-full h-10 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {unsubscribing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Unsubscribing...
                    </>
                  ) : (
                    'Yes, unsubscribe me'
                  )}
                </button>
                <p className="text-xs text-slate-400">
                  You will stop receiving all future emails from this sender.
                </p>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          This unsubscribe page is CAN-SPAM compliant.
        </p>
      </div>
    </div>
  )
}
