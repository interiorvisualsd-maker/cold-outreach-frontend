'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { downloadCsv } from '@/lib/download'
import { useToast } from '@/hooks/use-toast'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import {
  Send,
  Loader2,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Play,
  Pause,
  ArrowLeft,
  ArrowRight,
  Mail,
  Clock,
  Users,
  Download,
  Shield,
  RotateCcw,
  XCircle,
  Eye,
  MousePointerClick,
  Reply,
  TrendingUp,
  BarChart3,
  Filter,
  Copy,
  Check,
} from 'lucide-react'
import { statusBadgeClass, EmptyState } from './dashboard'

interface CampaignListItem {
  id: string
  name: string
  status: string
  totalLeads: number
  csvFilename: string | null
  sendingWindowStart: number
  sendingWindowEnd: number
  timezone: string
  fromNameOverride: string | null
  createdAt: string
  _count: { leads: number; steps: number; scheduledEmails: number }
}

interface EmailStep {
  id: string
  stepNumber: number
  delayDays: number
  subject: string
  body: string
}

interface CampaignDetail extends CampaignListItem {
  steps: EmailStep[]
}

interface Lead {
  id: string
  email: string
  companyName: string | null
  status: string
  currentStep: number
  createdAt: string
}

interface LeadsResponse {
  leads: Lead[]
  total: number
  page: number
  limit: number
  pages: number
}

interface CampaignAnalytics {
  campaign: { id: string; name: string; status: string; totalLeads: number }
  leadStatusBreakdown: Record<string, number>
  funnel: {
    totalLeads: number
    sent: number
    opened: number
    clicked: number
    replied: number
    openRate: number
    clickRate: number
    replyRate: number
  }
  sentimentBreakdown: Record<string, number>
  trend: Array<{ date: string; sent: number; opened: number }>
  stepCount: number
}

interface BulkResult {
  ok: boolean
  action: string
  affected: number
}

const LEAD_STATUSES = ['pending', 'step1_sent', 'step2_sent', 'step3_sent', 'replied', 'suppressed', 'bounced', 'unsubscribed']

function leadStatusBadgeClass(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-slate-100 text-slate-600 border-slate-200'
    case 'step1_sent':
    case 'step2_sent':
    case 'step3_sent':
      return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'replied':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'suppressed':
    case 'bounced':
    case 'unsubscribed':
      return 'bg-rose-100 text-rose-700 border-rose-200'
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200'
  }
}

// Rate color coding: emerald = good, amber = ok, rose = bad
function rateTone(rate: number, good: number, ok: number, higherIsBetter = true): 'emerald' | 'amber' | 'rose' {
  if (higherIsBetter) {
    if (rate >= good) return 'emerald'
    if (rate >= ok) return 'amber'
    return 'rose'
  }
  // lowerIsBetter (e.g., bounce rate)
  if (rate <= good) return 'emerald'
  if (rate <= ok) return 'amber'
  return 'rose'
}

const toneClasses: Record<'emerald' | 'amber' | 'rose', { text: string; bg: string; ring: string }> = {
  emerald: {
    text: 'text-emerald-600',
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-200',
  },
  amber: {
    text: 'text-amber-600',
    bg: 'bg-amber-50',
    ring: 'ring-amber-200',
  },
  rose: {
    text: 'text-rose-600',
    bg: 'bg-rose-50',
    ring: 'ring-rose-200',
  },
}

const sentimentMeta: Record<string, { label: string; className: string }> = {
  interested: {
    label: 'Interested',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  not_interested: {
    label: 'Not Interested',
    className: 'bg-rose-100 text-rose-700 border-rose-200',
  },
  neutral: {
    label: 'Neutral',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  ooo: {
    label: 'Out of Office',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  unsubscribe: {
    label: 'Unsubscribe',
    className: 'bg-rose-100 text-rose-700 border-rose-200',
  },
  untagged: {
    label: 'Untagged',
    className: 'bg-slate-100 text-slate-500 border-slate-200',
  },
}

// Status colors for the breakdown pie chart — keep within slate/emerald/amber/rose/teal palette
const STATUS_COLORS: Record<string, string> = {
  pending: '#94a3b8',        // slate-400
  step1_sent: '#f59e0b',     // amber-500
  step2_sent: '#fbbf24',     // amber-400
  step3_sent: '#fcd34d',     // amber-300
  replied: '#10b981',        // emerald-500
  suppressed: '#f43f5e',     // rose-500
  bounced: '#e11d48',        // rose-600
  unsubscribed: '#fb7185',   // rose-400
}

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
}

// ─── CopyEmailButton — small inline copy-to-clipboard for email fields ──
function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(email)
      } else {
        // Fallback for non-secure contexts
        const ta = document.createElement('textarea')
        ta.value = email
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Silently ignore — best-effort UX feature
    }
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
      onClick={handleCopy}
      title={`Copy ${email}`}
      aria-label={`Copy ${email}`}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
    </Button>
  )
}

export function CampaignsView() {
  const { toast } = useToast()
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CampaignDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    sendingWindowStart: '9',
    sendingWindowEnd: '17',
    timezone: 'UTC',
    fromNameOverride: '',
  })
  const [creating, setCreating] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [actioningId, setActioningId] = useState<string | null>(null)

  // Leads table state
  const [leads, setLeads] = useState<Lead[]>([])
  const [leadsTotal, setLeadsTotal] = useState(0)
  const [leadsPage, setLeadsPage] = useState(1)
  const [leadsPages, setLeadsPages] = useState(1)
  const [leadsStatus, setLeadsStatus] = useState<string>('all')
  const [leadsLoading, setLeadsLoading] = useState(false)

  // Step editor state
  const [stepDialogOpen, setStepDialogOpen] = useState(false)
  const [editingStep, setEditingStep] = useState<{ stepNumber: number; delayDays: number; subject: string; body: string } | null>(null)
  const [savingStep, setSavingStep] = useState(false)

  // Analytics + bulk actions state
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<null | 'suppress' | 'delete' | 'requeue' | 'cancel'>(null)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [exportingLeads, setExportingLeads] = useState(false)
  const [exportingQueue, setExportingQueue] = useState(false)

  const loadList = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      try {
        const res = await api.get<{ campaigns: CampaignListItem[] }>('/api/campaigns')
        setCampaigns(res.campaigns || [])
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        toast({ title: 'Failed to load campaigns', description: msg, variant: 'destructive' })
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    loadList()
  }, [loadList])

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true)
      try {
        const res = await api.get<{ campaign: CampaignDetail }>(`/api/campaigns/${id}`)
        setDetail(res.campaign)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        toast({ title: 'Failed to load campaign', description: msg, variant: 'destructive' })
      } finally {
        setDetailLoading(false)
      }
    },
    [toast],
  )

  const loadLeads = useCallback(
    async (id: string, page: number, status: string) => {
      setLeadsLoading(true)
      try {
        const query = `page=${page}&limit=50${status !== 'all' ? `&status=${status}` : ''}`
        const res = await api.get<LeadsResponse>(`/api/campaigns/${id}/leads?${query}`)
        setLeads(res.leads || [])
        setLeadsTotal(res.total)
        setLeadsPage(res.page)
        setLeadsPages(res.pages)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        toast({ title: 'Failed to load leads', description: msg, variant: 'destructive' })
      } finally {
        setLeadsLoading(false)
      }
    },
    [toast],
  )

  const loadAnalytics = useCallback(
    async (id: string) => {
      setAnalyticsLoading(true)
      try {
        const res = await api.get<CampaignAnalytics>(`/api/exports/campaign-analytics/${id}`)
        setAnalytics(res)
      } catch (err: unknown) {
        // Analytics is non-fatal — silently clear so we show a subtle empty state
        setAnalytics(null)
        const msg = err instanceof Error ? err.message : 'Unknown error'
        toast({ title: 'Failed to load campaign analytics', description: msg, variant: 'destructive' })
      } finally {
        setAnalyticsLoading(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId)
      setLeadsPage(1)
      setLeadsStatus('all')
      loadLeads(selectedId, 1, 'all')
      loadAnalytics(selectedId)
      setSelectedLeadIds(new Set())
    }
  }, [selectedId, loadDetail, loadLeads, loadAnalytics])

  const openCampaign = (id: string) => {
    setSelectedId(id)
  }

  const backToList = () => {
    setSelectedId(null)
    setDetail(null)
    setLeads([])
    setAnalytics(null)
    setSelectedLeadIds(new Set())
  }

  const createCampaign = async () => {
    if (!createForm.name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' })
      return
    }
    setCreating(true)
    try {
      const start = parseInt(createForm.sendingWindowStart)
      const end = parseInt(createForm.sendingWindowEnd)
      await api.post('/api/campaigns', {
        name: createForm.name,
        sendingWindowStart: start,
        sendingWindowEnd: end,
        timezone: createForm.timezone,
        fromNameOverride: createForm.fromNameOverride || null,
      })
      toast({ title: 'Campaign created', description: createForm.name })
      setCreateOpen(false)
      setCreateForm({ name: '', sendingWindowStart: '9', sendingWindowEnd: '17', timezone: 'UTC', fromNameOverride: '' })
      loadList(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Create failed'
      toast({ title: 'Failed', description: msg, variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const startCampaign = async (id: string) => {
    setActioningId(id)
    try {
      const res = await api.post<{ queued: number; campaign: CampaignListItem }>(`/api/campaigns/${id}/start`)
      toast({ title: 'Campaign started', description: `${res.queued} emails queued for step 1` })
      loadList(true)
      if (selectedId === id) {
        loadDetail(id)
        loadAnalytics(id)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Start failed'
      toast({ title: 'Failed', description: msg, variant: 'destructive' })
    } finally {
      setActioningId(null)
    }
  }

  const pauseCampaign = async (id: string) => {
    setActioningId(id)
    try {
      await api.post(`/api/campaigns/${id}/pause`)
      toast({ title: 'Campaign paused' })
      loadList(true)
      if (selectedId === id) loadDetail(id)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Pause failed'
      toast({ title: 'Failed', description: msg, variant: 'destructive' })
    } finally {
      setActioningId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await api.delete(`/api/campaigns/${deleteId}`)
      toast({ title: 'Campaign deleted' })
      setDeleteId(null)
      if (selectedId === deleteId) backToList()
      loadList(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed'
      toast({ title: 'Failed', description: msg, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const openStepEditor = (step?: EmailStep, stepNumber?: number) => {
    if (step) {
      setEditingStep({
        stepNumber: step.stepNumber,
        delayDays: step.delayDays,
        subject: step.subject,
        body: step.body,
      })
    } else {
      setEditingStep({
        stepNumber: stepNumber || 1,
        delayDays: stepNumber === 2 ? 3 : stepNumber === 3 ? 7 : 0,
        subject: '',
        body: '',
      })
    }
    setStepDialogOpen(true)
  }

  const saveStep = async () => {
    if (!selectedId || !editingStep) return
    if (!editingStep.subject || !editingStep.body) {
      toast({ title: 'Subject and body required', variant: 'destructive' })
      return
    }
    setSavingStep(true)
    try {
      await api.post(`/api/campaigns/${selectedId}/steps`, editingStep)
      toast({ title: `Step ${editingStep.stepNumber} saved` })
      setStepDialogOpen(false)
      setEditingStep(null)
      loadDetail(selectedId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      toast({ title: 'Failed', description: msg, variant: 'destructive' })
    } finally {
      setSavingStep(false)
    }
  }

  // ─── Bulk actions ───
  const toggleLead = (id: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllLeads = () => {
    setSelectedLeadIds((prev) => {
      if (prev.size === leads.length && leads.length > 0) {
        return new Set()
      }
      return new Set(leads.map((l) => l.id))
    })
  }

  const clearSelection = () => setSelectedLeadIds(new Set())

  const runBulkAction = async () => {
    if (!bulkAction || selectedLeadIds.size === 0) return
    setBulkActionLoading(true)
    try {
      const res = await api.post<BulkResult>('/api/exports/leads/bulk', {
        leadIds: Array.from(selectedLeadIds),
        action: bulkAction,
      })
      const verb: Record<string, string> = {
        suppress: 'suppressed',
        delete: 'deleted',
        requeue: 're-queued',
        cancel: 'cancelled queue for',
      }
      toast({
        title: `Bulk action complete`,
        description: `${res.affected} lead${res.affected === 1 ? '' : 's'} ${verb[bulkAction] || bulkAction}.`,
      })
      setBulkAction(null)
      setSelectedLeadIds(new Set())
      if (selectedId) {
        loadLeads(selectedId, leadsPage, leadsStatus)
        loadAnalytics(selectedId)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bulk action failed'
      toast({ title: 'Failed', description: msg, variant: 'destructive' })
    } finally {
      setBulkActionLoading(false)
    }
  }

  const exportLeads = async () => {
    if (!selectedId) return
    setExportingLeads(true)
    try {
      await downloadCsv(
        `/api/exports/export/leads?campaignId=${selectedId}`,
        `leads-campaign-${selectedId}-${new Date().toISOString().slice(0, 10)}.csv`,
      )
      toast({ title: 'Leads exported', description: 'CSV download started' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed'
      toast({ title: 'Export failed', description: msg, variant: 'destructive' })
    } finally {
      setExportingLeads(false)
    }
  }

  const exportQueue = async () => {
    if (!selectedId) return
    setExportingQueue(true)
    try {
      await downloadCsv(
        `/api/exports/export/queue?campaignId=${selectedId}`,
        `queue-campaign-${selectedId}-${new Date().toISOString().slice(0, 10)}.csv`,
      )
      toast({ title: 'Queue exported', description: 'CSV download started' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed'
      toast({ title: 'Export failed', description: msg, variant: 'destructive' })
    } finally {
      setExportingQueue(false)
    }
  }

  // ─── Detail View ───
  if (selectedId) {
    const funnelStages = analytics
      ? [
          { label: 'Total Leads', value: analytics.funnel.totalLeads, tone: 'slate' as const },
          { label: 'Sent', value: analytics.funnel.sent, tone: 'amber' as const },
          { label: 'Opened', value: analytics.funnel.opened, tone: 'teal' as const },
          { label: 'Clicked', value: analytics.funnel.clicked, tone: 'emerald' as const },
          { label: 'Replied', value: analytics.funnel.replied, tone: 'emerald' as const },
        ]
      : []
    const maxFunnel = funnelStages.length > 0 ? Math.max(...funnelStages.map((s) => s.value), 1) : 1
    const bounceCount = analytics?.leadStatusBreakdown?.bounced ?? 0
    const bounceRate = analytics && analytics.funnel.totalLeads > 0
      ? Math.round((bounceCount / analytics.funnel.totalLeads) * 1000) / 10
      : 0

    // Lead status breakdown data for chart
    const statusBreakdownData = analytics
      ? Object.entries(analytics.leadStatusBreakdown)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
      : []

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={backToList}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight truncate">
                  {detail?.name || 'Loading…'}
                </h1>
                {detail && (
                  <Badge variant="outline" className={statusBadgeClass(detail.status)}>
                    {detail.status}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {detail ? `${detail._count.leads} leads · ${detail._count.scheduledEmails} scheduled` : ''}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={exportLeads} disabled={exportingLeads || detailLoading}>
              {exportingLeads ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export Leads
            </Button>
            <Button size="sm" variant="outline" onClick={exportQueue} disabled={exportingQueue || detailLoading}>
              {exportingQueue ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export Queue
            </Button>
            {detail?.status === 'draft' && (
              <Button size="sm" onClick={() => startCampaign(detail.id)} disabled={actioningId === detail.id}>
                {actioningId === detail.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Start
              </Button>
            )}
            {detail?.status === 'active' && (
              <Button size="sm" variant="outline" onClick={() => pauseCampaign(detail.id)} disabled={actioningId === detail.id}>
                {actioningId === detail.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
                Pause
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setDeleteId(detail.id)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        {detailLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : detail ? (
          <>
            {/* ─── Analytics Panel ─── */}
            {analyticsLoading ? (
              <Card className="p-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                  <Skeleton className="h-48 w-full" />
                  <Skeleton className="h-48 w-full" />
                </div>
              </Card>
            ) : analytics ? (
              <motion.div {...fadeUp} className="space-y-4">
                {/* Funnel visualization */}
                <Card className="p-6">
                  <CardHeader className="p-0 mb-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="h-4 w-4" />
                      Conversion Funnel
                    </CardTitle>
                    <CardDescription>
                      Lead progression through the sequence — width is proportional to count
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 space-y-2">
                    {funnelStages.map((stage, idx) => {
                      const pct = maxFunnel > 0 ? Math.round((stage.value / maxFunnel) * 100) : 0
                      const prevValue = idx > 0 ? funnelStages[idx - 1].value : null
                      const convPct = prevValue && prevValue > 0
                        ? Math.round((stage.value / prevValue) * 1000) / 10
                        : null
                      const barColor =
                        stage.tone === 'slate' ? 'bg-slate-400' :
                        stage.tone === 'amber' ? 'bg-amber-400' :
                        stage.tone === 'teal' ? 'bg-teal-400' :
                        'bg-emerald-500'
                      return (
                        <div key={stage.label}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium">{stage.label}</span>
                            <span className="text-muted-foreground">
                              {stage.value.toLocaleString()}
                              {idx > 0 && analytics.funnel.totalLeads > 0 && (
                                <span className="ml-2 text-muted-foreground/70">
                                  ({Math.round((stage.value / analytics.funnel.totalLeads) * 1000) / 10}% of leads)
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="h-7 w-full rounded-md bg-muted overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6, delay: idx * 0.08, ease: 'easeOut' }}
                              className={`h-full ${barColor} flex items-center justify-end pr-2`}
                            >
                              <span className="text-[10px] font-bold text-white/90">{pct}%</span>
                            </motion.div>
                          </div>
                          {idx < funnelStages.length - 1 && convPct !== null && (
                            <div className="flex items-center justify-center my-1 text-[10px] text-muted-foreground">
                              <ArrowRight className="h-3 w-3 mx-1" />
                              <span>{convPct}% conversion</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>

                {/* Rate cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {(() => {
                    const cards = [
                      {
                        label: 'Open Rate',
                        value: analytics.funnel.openRate,
                        icon: Eye,
                        tone: rateTone(analytics.funnel.openRate, 30, 10),
                      },
                      {
                        label: 'Click Rate',
                        value: analytics.funnel.clickRate,
                        icon: MousePointerClick,
                        tone: rateTone(analytics.funnel.clickRate, 5, 1),
                      },
                      {
                        label: 'Reply Rate',
                        value: analytics.funnel.replyRate,
                        icon: Reply,
                        tone: rateTone(analytics.funnel.replyRate, 5, 1),
                      },
                      {
                        label: 'Bounce Rate',
                        value: bounceRate,
                        icon: XCircle,
                        tone: rateTone(bounceRate, 2, 5, false),
                      },
                    ]
                    return cards.map((c) => {
                      const Icon = c.icon
                      const t = toneClasses[c.tone]
                      return (
                        <Card key={c.label} className={`p-4 ring-1 ${t.ring}`}>
                          <CardContent className="p-0 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                {c.label}
                              </p>
                              <Icon className={`h-4 w-4 ${t.text}`} />
                            </div>
                            <p className={`text-2xl font-bold ${t.text}`}>{c.value}%</p>
                            <p className="text-[10px] text-muted-foreground">
                              {c.tone === 'emerald' ? 'Healthy' : c.tone === 'amber' ? 'Acceptable' : 'Needs attention'}
                            </p>
                          </CardContent>
                        </Card>
                      )
                    })
                  })()}
                </div>

                {/* Charts row: trend + status breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* 7-day trend */}
                  <Card className="p-6">
                    <CardHeader className="p-0 mb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <TrendingUp className="h-4 w-4" />
                        7-Day Send Trend
                      </CardTitle>
                      <CardDescription>Emails sent vs opened, last 7 days</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={analytics.trend} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                            <defs>
                              <linearGradient id="ldSentFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="ldOpenedFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.5} />
                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" vertical={false} />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 10 }}
                              tickFormatter={(d: string) => d.slice(5)}
                              stroke="hsl(var(--muted-foreground))"
                            />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                            <Tooltip
                              contentStyle={{
                                background: 'hsl(var(--popover))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '6px',
                                fontSize: '12px',
                              }}
                              labelFormatter={(d: string) => d}
                            />
                            <Area
                              type="monotone"
                              dataKey="sent"
                              name="Sent"
                              stroke="#10b981"
                              strokeWidth={2}
                              fill="url(#ldSentFill)"
                            />
                            <Area
                              type="monotone"
                              dataKey="opened"
                              name="Opened"
                              stroke="#f59e0b"
                              strokeWidth={2}
                              fill="url(#ldOpenedFill)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Lead status breakdown */}
                  <Card className="p-6">
                    <CardHeader className="p-0 mb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Users className="h-4 w-4" />
                        Lead Status Breakdown
                      </CardTitle>
                      <CardDescription>Current state of all leads in this campaign</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      {statusBreakdownData.length === 0 ? (
                        <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
                          No lead data yet
                        </div>
                      ) : (
                        <div className="h-56 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={statusBreakdownData}
                              layout="vertical"
                              margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" horizontal={false} />
                              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                              <YAxis
                                type="category"
                                dataKey="name"
                                tick={{ fontSize: 10 }}
                                stroke="hsl(var(--muted-foreground))"
                                width={90}
                              />
                              <Tooltip
                                contentStyle={{
                                  background: 'hsl(var(--popover))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                }}
                              />
                              <Bar dataKey="value" name="Leads" radius={[0, 4, 4, 0]}>
                                {statusBreakdownData.map((entry) => (
                                  <Cell
                                    key={entry.name}
                                    fill={STATUS_COLORS[entry.name] || '#94a3b8'}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Sentiment breakdown + status pie */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="p-6">
                    <CardHeader className="p-0 mb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Reply className="h-4 w-4" />
                        Reply Sentiment
                      </CardTitle>
                      <CardDescription>How recipients are responding</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      {Object.keys(analytics.sentimentBreakdown).length === 0 ? (
                        <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
                          No replies yet
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(analytics.sentimentBreakdown).map(([key, count]) => {
                            const meta = sentimentMeta[key] || sentimentMeta.untagged
                            return (
                              <Badge
                                key={key}
                                variant="outline"
                                className={`px-3 py-1 text-xs ${meta.className}`}
                              >
                                {meta.label}: <strong className="ml-1">{count}</strong>
                              </Badge>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="p-6">
                    <CardHeader className="p-0 mb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <BarChart3 className="h-4 w-4" />
                        Status Distribution
                      </CardTitle>
                      <CardDescription>Share of leads by current status</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      {statusBreakdownData.length === 0 ? (
                        <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
                          No lead data
                        </div>
                      ) : (
                        <div className="flex items-center gap-4">
                          <div className="h-32 w-32 shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={statusBreakdownData}
                                  dataKey="value"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={32}
                                  outerRadius={56}
                                  paddingAngle={2}
                                >
                                  {statusBreakdownData.map((entry) => (
                                    <Cell
                                      key={entry.name}
                                      fill={STATUS_COLORS[entry.name] || '#94a3b8'}
                                    />
                                  ))}
                                </Pie>
                                <Tooltip
                                  contentStyle={{
                                    background: 'hsl(var(--popover))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                  }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="flex-1 grid grid-cols-2 gap-1.5 text-xs">
                            {statusBreakdownData.map((s) => (
                              <div key={s.name} className="flex items-center gap-1.5">
                                <span
                                  className="h-2.5 w-2.5 rounded-sm"
                                  style={{ background: STATUS_COLORS[s.name] || '#94a3b8' }}
                                />
                                <span className="text-muted-foreground truncate">{s.name}</span>
                                <span className="font-medium ml-auto">{s.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            ) : null}

            {/* Sending window info */}
            <Card>
              <CardContent className="p-4 flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Window:</span>
                  <span className="font-medium">
                    {detail.sendingWindowStart}:00 – {detail.sendingWindowEnd}:00
                  </span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Timezone:</span>
                  <span className="font-medium">{detail.timezone}</span>
                </div>
                {detail.fromNameOverride && (
                  <>
                    <Separator orientation="vertical" className="h-4" />
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">From name:</span>
                      <span className="font-medium">{detail.fromNameOverride}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Steps */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Sequence Steps
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((num) => {
                  const step = detail.steps.find((s) => s.stepNumber === num)
                  return (
                    <Card key={num} className="p-4 flex flex-col">
                      <CardHeader className="p-0 mb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">Step {num}</CardTitle>
                          {step ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              {num === 1 ? 'Day 0' : `Day ${step.delayDays}`}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200">
                              Empty
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-0 flex-1 flex flex-col gap-2">
                        {step ? (
                          <>
                            <p className="text-sm font-medium line-clamp-1">{step.subject}</p>
                            <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                              {step.body}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground italic flex-1">
                            Not configured yet. Click edit to define this step.
                          </p>
                        )}
                      </CardContent>
                      <div className="pt-3 mt-2">
                        <Button variant="outline" size="sm" className="w-full" onClick={() => openStepEditor(step, num)}>
                          <Pencil className="h-3.5 w-3.5" />
                          {step ? 'Edit Step' : 'Define Step'}
                        </Button>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>

            {/* Leads with bulk actions */}
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Leads ({leadsTotal})
                    </CardTitle>
                    <CardDescription>Filter, inspect, and bulk-manage leads</CardDescription>
                  </div>
                  <Select
                    value={leadsStatus}
                    onValueChange={(v) => {
                      setLeadsStatus(v)
                      setLeadsPage(1)
                      clearSelection()
                      loadLeads(selectedId, 1, v)
                    }}
                  >
                    <SelectTrigger className="w-[180px]">
                      <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {LEAD_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {leadsLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : leads.length === 0 ? (
                  <EmptyState
                    icon={<Users className="h-8 w-8" />}
                    title="No leads found"
                    description="Import a CSV under the Import CSV tab to populate this campaign."
                  />
                ) : (
                  <>
                    <div className="max-h-96 overflow-y-auto -mx-2 px-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40px]">
                              <Checkbox
                                checked={
                                  leads.length > 0 &&
                                  selectedLeadIds.size === leads.length
                                }
                                onCheckedChange={toggleAllLeads}
                                aria-label="Select all leads"
                              />
                            </TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-center">Step</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {leads.map((l) => (
                            <TableRow
                              key={l.id}
                              data-state={selectedLeadIds.has(l.id) ? 'selected' : undefined}
                              className={`group transition-colors ${selectedLeadIds.has(l.id) ? 'bg-muted/50' : 'hover:bg-muted/40'}`}
                            >
                              <TableCell>
                                <Checkbox
                                  checked={selectedLeadIds.has(l.id)}
                                  onCheckedChange={() => toggleLead(l.id)}
                                  aria-label={`Select ${l.email}`}
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate">{l.email}</span>
                                  <CopyEmailButton email={l.email} />
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{l.companyName || '—'}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={leadStatusBadgeClass(l.status)}>
                                  {l.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">{l.currentStep}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex items-center justify-between mt-3 text-sm">
                      <span className="text-muted-foreground">
                        Page {leadsPage} of {Math.max(1, leadsPages)}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={leadsPage <= 1 || leadsLoading}
                          onClick={() => {
                            const p = leadsPage - 1
                            setLeadsPage(p)
                            loadLeads(selectedId, p, leadsStatus)
                          }}
                        >
                          Previous
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={leadsPage >= leadsPages || leadsLoading}
                          onClick={() => {
                            const p = leadsPage + 1
                            setLeadsPage(p)
                            loadLeads(selectedId, p, leadsStatus)
                          }}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {/* Floating bulk action bar */}
                {selectedLeadIds.size > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="sticky bottom-4 z-20 mt-4"
                  >
                    <div className="rounded-lg border bg-background/95 backdrop-blur shadow-lg p-3 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="mr-2">
                        {selectedLeadIds.size} selected
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setBulkAction('suppress')}
                        className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Shield className="h-3.5 w-3.5" />
                        Suppress
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setBulkAction('cancel')}
                        className="text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Cancel Queue
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setBulkAction('requeue')}
                        className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Re-queue Step 1
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setBulkAction('delete')}
                        className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={clearSelection}
                        className="ml-auto text-muted-foreground"
                      >
                        Clear
                      </Button>
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}

        {/* Step editor dialog */}
        <Dialog open={stepDialogOpen} onOpenChange={setStepDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingStep ? `Edit Step ${editingStep.stepNumber}` : 'Define Step'}
              </DialogTitle>
              <DialogDescription>
                Step {editingStep?.stepNumber} content for the email sequence.
              </DialogDescription>
            </DialogHeader>
            {editingStep && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="step-num">Step Number</Label>
                    <Input
                      id="step-num"
                      type="number"
                      min={1}
                      max={3}
                      value={editingStep.stepNumber}
                      onChange={(e) =>
                        setEditingStep({ ...editingStep, stepNumber: parseInt(e.target.value) || 1 })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="step-delay">Delay Days (after step 1)</Label>
                    <Input
                      id="step-delay"
                      type="number"
                      min={0}
                      value={editingStep.delayDays}
                      onChange={(e) =>
                        setEditingStep({ ...editingStep, delayDays: parseInt(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="step-subject">Subject</Label>
                  <Input
                    id="step-subject"
                    value={editingStep.subject}
                    onChange={(e) => setEditingStep({ ...editingStep, subject: e.target.value })}
                    placeholder="Quick question about {{company}}"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="step-body">Body</Label>
                  <Textarea
                    id="step-body"
                    rows={8}
                    value={editingStep.body}
                    onChange={(e) => setEditingStep({ ...editingStep, body: e.target.value })}
                    placeholder="Hi {{first_name}},&#10;&#10;Saw your company…"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStepDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveStep} disabled={savingStep}>
                {savingStep ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save Step
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk action confirmation */}
        <AlertDialog
          open={bulkAction !== null}
          onOpenChange={(o) => !o && setBulkAction(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                {bulkAction === 'delete' && <Trash2 className="h-5 w-5 text-rose-600" />}
                {bulkAction === 'suppress' && <Shield className="h-5 w-5 text-rose-600" />}
                {bulkAction === 'cancel' && <XCircle className="h-5 w-5 text-amber-600" />}
                {bulkAction === 'requeue' && <RotateCcw className="h-5 w-5 text-emerald-600" />}
                {bulkAction === 'delete' && 'Delete leads permanently?'}
                {bulkAction === 'suppress' && 'Suppress selected leads?'}
                {bulkAction === 'cancel' && 'Cancel queued emails?'}
                {bulkAction === 'requeue' && 'Re-queue step 1?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {bulkAction === 'delete' && (
                  <>
                    This will permanently delete <strong>{selectedLeadIds.size}</strong> lead
                    {selectedLeadIds.size === 1 ? '' : 's'} and all their scheduled emails + replies.
                    This action cannot be undone.
                  </>
                )}
                {bulkAction === 'suppress' && (
                  <>
                    <strong>{selectedLeadIds.size}</strong> lead
                    {selectedLeadIds.size === 1 ? '' : 's'} will be marked as suppressed, their
                    emails added to the suppression list, and any queued emails cancelled.
                  </>
                )}
                {bulkAction === 'cancel' && (
                  <>
                    All <strong>queued</strong> scheduled emails for the{' '}
                    <strong>{selectedLeadIds.size}</strong> selected lead
                    {selectedLeadIds.size === 1 ? '' : 's'} will be cancelled. Already-sent emails are unaffected.
                  </>
                )}
                {bulkAction === 'requeue' && (
                  <>
                    Step 1 will be re-queued for <strong>{selectedLeadIds.size}</strong> lead
                    {selectedLeadIds.size === 1 ? '' : 's'}. Existing queued emails will be cancelled
                    and lead status reset to pending.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bulkActionLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={runBulkAction}
                disabled={bulkActionLoading}
                className={
                  bulkAction === 'delete'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : bulkAction === 'suppress'
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : bulkAction === 'cancel'
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }
              >
                {bulkActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {bulkAction === 'delete' && 'Delete'}
                {bulkAction === 'suppress' && 'Suppress'}
                {bulkAction === 'cancel' && 'Cancel Queue'}
                {bulkAction === 'requeue' && 'Re-queue'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete campaign confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the campaign, all its leads, steps, and scheduled
                emails. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                disabled={deleting}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  // ─── List View ───
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Manage 3-step sequences and lead lists</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => loadList(true)} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New Campaign
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Send className="h-8 w-8" />}
              title="No campaigns yet"
              description="Create your first campaign, then import leads via the Import CSV tab."
              action={
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New Campaign
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {campaigns.map((c) => (
            <Card key={c.id} className="p-4 flex flex-col">
              <CardHeader className="p-0 mb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{c.name}</CardTitle>
                  <Badge variant="outline" className={statusBadgeClass(c.status)}>
                    {c.status}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Created {new Date(c.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col gap-2">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="text-lg font-semibold">{c._count.leads}</p>
                    <p className="text-xs text-muted-foreground">Leads</p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="text-lg font-semibold">{c._count.steps}</p>
                    <p className="text-xs text-muted-foreground">Steps</p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="text-lg font-semibold">{c._count.scheduledEmails}</p>
                    <p className="text-xs text-muted-foreground">Queued</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {c.sendingWindowStart}:00 – {c.sendingWindowEnd}:00 ({c.timezone})
                  </span>
                </div>
                {c.csvFilename && (
                  <p className="text-xs text-muted-foreground truncate">CSV: {c.csvFilename}</p>
                )}
              </CardContent>
              <div className="pt-3 mt-2 flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => openCampaign(c.id)}>
                  Open
                </Button>
                {c.status === 'draft' && (
                  <Button
                    size="sm"
                    onClick={() => startCampaign(c.id)}
                    disabled={actioningId === c.id}
                  >
                    {actioningId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Start
                  </Button>
                )}
                {c.status === 'active' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => pauseCampaign(c.id)}
                    disabled={actioningId === c.id}
                  >
                    {actioningId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
                    Pause
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setDeleteId(c.id)}>
                  <Trash2 className="h-4 w-4 text-rose-600" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Campaign</DialogTitle>
            <DialogDescription>Configure sending window and timezone. Add steps after creation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="camp-name">Campaign Name</Label>
              <Input
                id="camp-name"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="Q4 SaaS outreach"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="camp-start">Window Start (hour)</Label>
                <Select
                  value={createForm.sendingWindowStart}
                  onValueChange={(v) => setCreateForm({ ...createForm, sendingWindowStart: v })}
                >
                  <SelectTrigger id="camp-start" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {String(i).padStart(2, '0')}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="camp-end">Window End (hour)</Label>
                <Select
                  value={createForm.sendingWindowEnd}
                  onValueChange={(v) => setCreateForm({ ...createForm, sendingWindowEnd: v })}
                >
                  <SelectTrigger id="camp-end" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {String(i).padStart(2, '0')}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="camp-tz">Timezone</Label>
                <Input
                  id="camp-tz"
                  value={createForm.timezone}
                  onChange={(e) => setCreateForm({ ...createForm, timezone: e.target.value })}
                  placeholder="UTC"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="camp-from">From Name Override (optional)</Label>
                <Input
                  id="camp-from"
                  value={createForm.fromNameOverride}
                  onChange={(e) => setCreateForm({ ...createForm, fromNameOverride: e.target.value })}
                  placeholder="Uses account default"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createCampaign} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the campaign, all its leads, steps, and scheduled emails.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
