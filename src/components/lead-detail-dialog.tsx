'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Send,
  Reply,
  Eye,
  MousePointerClick,
  Clock,
  XCircle,
  Mail,
  Building2,
  Globe,
  MapPin,
  Briefcase,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface LeadDetail {
  id: string
  email: string
  companyName: string | null
  website: string | null
  state: string | null
  industry: string | null
  status: string
  currentStep: number
  lastStepSentAt: string | null
  repliedAt: string | null
  bouncedAt: string | null
  unsubscribedAt: string | null
  createdAt: string
  campaign: { id: string; name: string; status: string } | null
}

interface TimelineEvent {
  id: string
  type: 'email_sent' | 'email_queued' | 'email_failed' | 'reply' | 'open' | 'click'
  timestamp: string
  title: string
  description: string
  metadata?: Record<string, any>
}

interface LeadDetailResponse {
  lead: LeadDetail
  timeline: TimelineEvent[]
  stats: {
    totalEmails: number
    sentEmails: number
    queuedEmails: number
    failedEmails: number
    totalOpens: number
    totalClicks: number
    totalReplies: number
  }
}

function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-slate-100 text-slate-600',
    step1_sent: 'bg-violet-100 text-violet-700',
    step2_sent: 'bg-violet-100 text-violet-700',
    step3_sent: 'bg-violet-100 text-violet-700',
    replied: 'bg-emerald-100 text-emerald-700',
    suppressed: 'bg-rose-100 text-rose-700',
    bounced: 'bg-rose-100 text-rose-700',
    unsubscribed: 'bg-amber-100 text-amber-700',
  }
  return map[status] || 'bg-slate-100 text-slate-600'
}

function eventIcon(type: string) {
  switch (type) {
    case 'email_sent':
      return { icon: Send, bg: 'bg-violet-100', tone: 'text-violet-600' }
    case 'email_queued':
      return { icon: Clock, bg: 'bg-slate-100', tone: 'text-slate-500' }
    case 'email_failed':
      return { icon: XCircle, bg: 'bg-rose-100', tone: 'text-rose-600' }
    case 'reply':
      return { icon: Reply, bg: 'bg-emerald-100', tone: 'text-emerald-600' }
    case 'open':
      return { icon: Eye, bg: 'bg-amber-100', tone: 'text-amber-600' }
    case 'click':
      return { icon: MousePointerClick, bg: 'bg-amber-100', tone: 'text-amber-600' }
    default:
      return { icon: Mail, bg: 'bg-slate-100', tone: 'text-slate-500' }
  }
}

interface LeadDetailDialogProps {
  leadId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LeadDetailDialog({ leadId, open, onOpenChange }: LeadDetailDialogProps) {
  const [data, setData] = useState<LeadDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !leadId) return
    let cancelled = false
    Promise.resolve().then(() => {
      if (cancelled) return
      setLoading(true)
      setError('')
    })
    api
      .get<LeadDetailResponse>(`/api/extras/leads/${leadId}/detail`)
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, leadId])

  const lead = data?.lead
  const timeline = data?.timeline || []
  const stats = data?.stats

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Lead detail</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-64" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <AlertCircle className="h-8 w-8 text-rose-400 mb-3" />
            <p className="text-sm font-medium text-slate-700">{error}</p>
          </div>
        ) : lead ? (
          <div>
            {/* Header */}
            <div className="border-b border-slate-200 p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
                    {lead.companyName ? (
                      <Building2 className="h-6 w-6 text-violet-600" />
                    ) : (
                      <Mail className="h-6 w-6 text-violet-600" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{lead.email}</h2>
                    {lead.companyName && (
                      <p className="text-sm text-slate-500">{lead.companyName}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge className={statusBadgeClass(lead.status)} variant="outline">
                        {lead.status.replace(/_/g, ' ')}
                      </Badge>
                      {lead.campaign && (
                        <Badge variant="outline" className="bg-slate-50 text-slate-600">
                          {lead.campaign.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Lead info grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                {[
                  { label: 'Website', value: lead.website, icon: Globe },
                  { label: 'Industry', value: lead.industry, icon: Briefcase },
                  { label: 'Location', value: lead.state, icon: MapPin },
                  { label: 'Current Step', value: lead.currentStep > 0 ? `Step ${lead.currentStep}` : 'Not started', icon: Send },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.label} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className="h-3 w-3 text-slate-400" />
                        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{item.label}</p>
                      </div>
                      <p className="text-sm font-medium text-slate-700 truncate">{item.value || '—'}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Stats row */}
            {stats && (
              <div className="grid grid-cols-4 gap-px bg-slate-200 border-b border-slate-200">
                {[
                  { label: 'Sent', value: stats.sentEmails, icon: Send, tone: 'text-violet-600' },
                  { label: 'Opens', value: stats.totalOpens, icon: Eye, tone: 'text-amber-600' },
                  { label: 'Clicks', value: stats.totalClicks, icon: MousePointerClick, tone: 'text-amber-600' },
                  { label: 'Replies', value: stats.totalReplies, icon: Reply, tone: 'text-emerald-600' },
                ].map((stat) => {
                  const Icon = stat.icon
                  return (
                    <div key={stat.label} className="bg-white p-3 text-center">
                      <Icon className={cn('h-4 w-4 mx-auto mb-1', stat.tone)} />
                      <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                      <p className="text-[11px] text-slate-400 uppercase tracking-wide">{stat.label}</p>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Timeline */}
            <div className="p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Activity Timeline</h3>
              {timeline.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Clock className="h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">No activity yet</p>
                </div>
              ) : (
                <div className="relative space-y-4">
                  {/* Vertical line */}
                  <div className="absolute left-[19px] top-2 bottom-2 w-px bg-slate-200" />
                  {timeline.map((event) => {
                    const { icon: Icon, bg, tone } = eventIcon(event.type)
                    return (
                      <div key={event.id} className="relative flex gap-3">
                        <div className={cn('relative z-10 flex h-10 w-10 items-center justify-center rounded-full shrink-0 ring-4 ring-white', bg)}>
                          <Icon className={cn('h-4 w-4', tone)} />
                        </div>
                        <div className="flex-1 min-w-0 pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-slate-900">{event.title}</p>
                            <p className="text-[11px] text-slate-400 shrink-0">
                              {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                            </p>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{event.description}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {format(new Date(event.timestamp), 'MMM d, yyyy h:mm a')}
                          </p>
                          {event.metadata?.body && (
                            <details className="mt-2">
                              <summary className="text-xs text-violet-600 cursor-pointer hover:text-violet-700">
                                View message
                              </summary>
                              <div className="mt-1.5 rounded-lg bg-slate-50 border border-slate-200 p-3">
                                <p className="text-xs text-slate-600 whitespace-pre-wrap line-clamp-6">
                                  {event.metadata.body}
                                </p>
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
