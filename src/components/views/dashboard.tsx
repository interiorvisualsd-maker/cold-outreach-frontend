'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { api } from '@/lib/api'
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
import { Progress } from '@/components/ui/progress'
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
  Send,
  Inbox,
  Users,
  Activity,
  Loader2,
  RefreshCw,
  Mailbox,
  Zap,
  AlertCircle,
  Mail,
  Reply,
  ShieldCheck,
  ArrowUpRight,
  MessageCircle,
  ThumbsUp,
  Sprout,
  TrendingUp,
  Sparkles,
  FileSpreadsheet,
  Flame,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────
interface DispatcherStats {
  queue: {
    queued: number
    assigned: number
    sending: number
    sent: number
    failed: number
    cancelled: number
  }
  accounts: Array<{
    id: string
    label: string
    emailAddress: string
    status: string
    sentToday: number
    warmupSentToday: number
    dailyCap: number
    warmupState: string
    failureStreak: number
    lastSentAt: string | null
  }>
  summary: {
    totalSentToday: number
    totalCapacity: number
    activeAccounts: number
    totalAccounts: number
    utilization: number
  }
}

interface UniboxStats {
  totalReplies: number
  unreadReplies: number
  repliedToday: number
  suppressedCount: number
}

interface CampaignSummary {
  id: string
  name: string
  status: string
  totalLeads: number
  csvFilename: string | null
  createdAt: string
  _count: { leads: number; steps: number; scheduledEmails: number }
}

interface TrendPoint {
  date: string
  sent: number
}

interface ActivityItem {
  type: string
  email: string
  company: string | null
  campaign: string | null
  sentiment?: string | null
  timestamp: string
  label: string
}

interface AnalyticsResponse {
  trend: TrendPoint[]
  sentimentBreakdown: {
    interested: number
    not_interested: number
    neutral: number
    ooo: number
    unsubscribe: number
    untagged: number
  }
  deliverabilityScore: number
  rates: { replyRate: number; bounceRate: number; unsubRate: number }
  totals: { totalSent: number; totalReplies: number; totalBounced: number; totalUnsub: number }
  activity: ActivityItem[]
}

// ─── Shared helpers (kept for sibling views importing them) ──────────
export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'paused':
      return 'bg-slate-100 text-slate-700 border-slate-200'
    case 'suspended':
    case 'error':
      return 'bg-rose-100 text-rose-700 border-rose-200'
    case 'draft':
      return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'completed':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

export function warmupBadgeClass(state: string): string {
  switch (state) {
    case 'cold':
      return 'bg-slate-100 text-slate-600 border-slate-200'
    case 'heating':
      return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'warm':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'paused':
      return 'bg-slate-100 text-slate-600 border-slate-200'
    case 'suspended':
      return 'bg-rose-100 text-rose-700 border-rose-200'
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200'
  }
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="rounded-full bg-muted p-3 text-muted-foreground mb-3">
        {icon}
      </div>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ─── Animation helpers ────────────────────────────────────────────────
const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
}

// ─── Color tokens (NO indigo / blue) ──────────────────────────────────
const SENTIMENT_COLORS: Record<string, string> = {
  interested: '#10b981',       // emerald-500
  not_interested: '#e11d48',   // rose-600
  neutral: '#64748b',          // slate-500
  ooo: '#f59e0b',              // amber-500
  unsubscribe: '#9f1239',      // rose-800
  untagged: '#94a3b8',         // slate-400
}

function scoreColor(score: number): string {
  if (score >= 80) return '#10b981' // emerald
  if (score >= 60) return '#f59e0b' // amber
  return '#e11d48' // rose
}

function sentimentBadgeClass(s: string | null | undefined): string | null {
  if (!s) return null
  switch (s) {
    case 'interested':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'not_interested':
    case 'unsubscribe':
      return 'bg-rose-100 text-rose-700 border-rose-200'
    case 'ooo':
      return 'bg-slate-100 text-slate-600 border-slate-200'
    case 'neutral':
    default:
      return 'bg-amber-100 text-amber-700 border-amber-200'
  }
}

function activityIcon(type: string, sentiment?: string | null) {
  if (type === 'sent') {
    return { icon: ArrowUpRight, tone: 'text-emerald-600 bg-emerald-50' }
  }
  if (type === 'reply') {
    if (sentiment === 'interested') {
      return { icon: ThumbsUp, tone: 'text-emerald-600 bg-emerald-50' }
    }
    if (sentiment === 'not_interested' || sentiment === 'unsubscribe') {
      return { icon: MessageCircle, tone: 'text-rose-600 bg-rose-50' }
    }
    return { icon: Reply, tone: 'text-amber-600 bg-amber-50' }
  }
  return { icon: Activity, tone: 'text-slate-600 bg-slate-100' }
}

function shortDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ─── Component ────────────────────────────────────────────────────────
export function DashboardView({ onNavigate }: { onNavigate?: (view: 'accounts' | 'campaigns' | 'csv' | 'unibox' | 'templates' | 'warmup') => void }) {
  const { toast } = useToast()
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)
  const [stats, setStats] = useState<DispatcherStats | null>(null)
  const [unibox, setUnibox] = useState<UniboxStats | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      try {
        const [an, disp, uni, camp] = await Promise.all([
          api.get<AnalyticsResponse>('/api/extras/analytics'),
          api.get<DispatcherStats>('/api/dispatcher/stats'),
          api.get<UniboxStats>('/api/unibox/stats'),
          api.get<{ campaigns: CampaignSummary[] }>('/api/campaigns'),
        ])
        setAnalytics(an)
        setStats(disp)
        setUnibox(uni)
        setCampaigns(camp.campaigns || [])
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        toast({
          title: 'Failed to load dashboard',
          description: msg,
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    load()
    const t = setInterval(() => load(true), 30000)
    return () => clearInterval(t)
  }, [load])

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const res = await api.post<{ ok: boolean; seeded: Record<string, number> }>(
        '/api/extras/seed',
      )
      toast({
        title: 'Demo data seeded',
        description: `+${res.seeded?.accounts ?? 0} accounts · +${res.seeded?.campaigns ?? 0} campaigns · +${res.seeded?.leads ?? 0} leads`,
      })
      await load(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Seed failed'
      toast({ title: 'Seed failed', description: msg, variant: 'destructive' })
    } finally {
      setSeeding(false)
    }
  }

  // ─── Derived values ────────────────────────────────────────────────
  const trend = analytics?.trend ?? []
  const total7d = trend.reduce((sum, p) => sum + p.sent, 0)
  const score = analytics?.deliverabilityScore ?? 0
  const sentiment = analytics?.sentimentBreakdown ?? {
    interested: 0,
    not_interested: 0,
    neutral: 0,
    ooo: 0,
    unsubscribe: 0,
    untagged: 0,
  }
  const sentimentTotal =
    sentiment.interested +
    sentiment.not_interested +
    sentiment.neutral +
    sentiment.ooo +
    sentiment.unsubscribe +
    sentiment.untagged
  const pieData = [
    { name: 'Interested', value: sentiment.interested, key: 'interested' },
    { name: 'Not Interested', value: sentiment.not_interested, key: 'not_interested' },
    { name: 'Neutral', value: sentiment.neutral, key: 'neutral' },
    { name: 'OOO', value: sentiment.ooo, key: 'ooo' },
    { name: 'Unsubscribe', value: sentiment.unsubscribe, key: 'unsubscribe' },
    { name: 'Untagged', value: sentiment.untagged, key: 'untagged' },
  ].filter((d) => d.value > 0)

  const summary = stats?.summary ?? {
    totalSentToday: 0,
    totalCapacity: 0,
    activeAccounts: 0,
    totalAccounts: 0,
    utilization: 0,
  }
  const accounts = stats?.accounts ?? []
  const activity = analytics?.activity ?? []
  const rates = analytics?.rates ?? { replyRate: 0, bounceRate: 0, unsubRate: 0 }
  const totals = analytics?.totals ?? { totalSent: 0, totalReplies: 0, totalBounced: 0, totalUnsub: 0 }

  // ─── Loading state ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-72 lg:col-span-2 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  // ─── Hero stat cards ───────────────────────────────────────────────
  const heroCards = [
    {
      label: 'Emails Sent',
      value: total7d,
      sub: `7-day total · ${totals.totalSent} all-time`,
      icon: Mail,
      tone: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Reply Rate',
      value: `${rates.replyRate}%`,
      sub: `${totals.totalReplies} replies received`,
      icon: Reply,
      tone: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Deliverability',
      value: score,
      sub: `${rates.bounceRate}% bounce · ${rates.unsubRate}% unsub`,
      icon: ShieldCheck,
      tone:
        score >= 80
          ? 'text-emerald-600'
          : score >= 60
            ? 'text-amber-600'
            : 'text-rose-600',
      bg:
        score >= 80
          ? 'bg-emerald-50'
          : score >= 60
            ? 'bg-amber-50'
            : 'bg-rose-50',
    },
    {
      label: 'Active Accounts',
      value: summary.activeAccounts,
      sub: `of ${summary.totalAccounts} total configured`,
      icon: Users,
      tone: 'text-slate-600',
      bg: 'bg-slate-100',
    },
  ]

  // ─── Dashboard score ring offset ───────────────────────────────────
  const ringColor = scoreColor(score)
  const ringDash = (score / 100) * 264

  return (
    <div className="space-y-6">
      {/* Header row */}
      <motion.div
        {...fadeUp}
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Real-time analytics & deliverability overview · auto-refreshes every 30s
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeed}
            disabled={seeding}
            className={total7d === 0 && totals.totalSent === 0 ? 'ld-pulse-soft border-amber-300 text-amber-700 hover:bg-amber-50' : ''}
            title={total7d === 0 && totals.totalSent === 0 ? 'No data yet — click to seed demo data' : 'Reseed demo data'}
          >
            {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Seed Demo Data
          </Button>
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Hero stat row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {heroCards.map((card, idx) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.label}
              {...fadeUp}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className="card-hover p-5 h-full">
                <CardContent className="p-0 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {card.label}
                    </p>
                    <div className={`rounded-lg p-2 ${card.bg}`}>
                      <Icon className={`h-4 w-4 ${card.tone}`} />
                    </div>
                  </div>
                  <p className="text-3xl font-bold leading-none">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.sub}</p>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Quick actions */}
      {onNavigate && (
        <motion.div {...fadeUp} transition={{ delay: 0.15 }}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide mr-1">Quick actions:</span>
            {[
              { label: 'New Campaign', view: 'campaigns' as const, icon: Send },
              { label: 'Import CSV', view: 'csv' as const, icon: FileSpreadsheet },
              { label: 'Add Account', view: 'accounts' as const, icon: Users },
              { label: 'Check Unibox', view: 'unibox' as const, icon: Inbox },
              { label: 'Warm-up Status', view: 'warmup' as const, icon: Flame },
            ].map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.label}
                  onClick={() => onNavigate(action.view)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-all"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {action.label}
                </button>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Deliverability ring + breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div {...fadeUp} transition={{ delay: 0.1 }}>
          <div className="rounded-xl bg-gradient-to-br from-emerald-500/40 via-amber-400/30 to-rose-500/40 p-px h-full">
          <Card className="p-6 h-full border-0 shadow-sm">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" />
                Deliverability Score
              </CardTitle>
              <CardDescription>Composite health based on bounce + unsubscribe rates</CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex flex-col items-center justify-center gap-3">
              <div className="relative h-44 w-44">
                <svg className="h-44 w-44 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke={ringColor}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${ringDash} 264`}
                    style={{ transition: 'stroke-dasharray 0.8s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className="text-4xl font-bold"
                    style={{ color: ringColor }}
                  >
                    {score}
                  </span>
                  <span className="text-xs text-muted-foreground">out of 100</span>
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  score >= 80
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    : score >= 60
                      ? 'bg-amber-100 text-amber-700 border-amber-200'
                      : 'bg-rose-100 text-rose-700 border-rose-200'
                }
              >
                {score >= 80 ? 'Healthy' : score >= 60 ? 'At Risk' : 'Critical'}
              </Badge>
            </CardContent>
          </Card>
          </div>
        </motion.div>

        <motion.div {...fadeUp} transition={{ delay: 0.15 }} className="lg:col-span-2">
          <Card className="p-6 h-full">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4" />
                Rate Breakdown
              </CardTitle>
              <CardDescription>Reply / bounce / unsubscribe rates vs total sent</CardDescription>
            </CardHeader>
            <CardContent className="p-0 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  label: 'Reply Rate',
                  value: rates.replyRate,
                  total: totals.totalReplies,
                  tone: 'emerald',
                  icon: Reply,
                },
                {
                  label: 'Bounce Rate',
                  value: rates.bounceRate,
                  total: totals.totalBounced,
                  tone: 'rose',
                  icon: AlertCircle,
                },
                {
                  label: 'Unsub Rate',
                  value: rates.unsubRate,
                  total: totals.totalUnsub,
                  tone: 'amber',
                  icon: Inbox,
                },
              ].map((m) => {
                const Icon = m.icon
                const toneText =
                  m.tone === 'emerald'
                    ? 'text-emerald-600'
                    : m.tone === 'rose'
                      ? 'text-rose-600'
                      : 'text-amber-600'
                const toneBg =
                  m.tone === 'emerald'
                    ? 'bg-emerald-50'
                    : m.tone === 'rose'
                      ? 'bg-rose-50'
                      : 'bg-amber-50'
                return (
                  <div
                    key={m.label}
                    className="rounded-lg border p-4 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {m.label}
                      </p>
                      <div className={`rounded-md p-1.5 ${toneBg}`}>
                        <Icon className={`h-3.5 w-3.5 ${toneText}`} />
                      </div>
                    </div>
                    <p className={`text-2xl font-bold ${toneText}`}>{m.value}%</p>
                    <p className="text-xs text-muted-foreground">
                      {m.total} {m.label.toLowerCase().includes('reply') ? 'replies' : m.label.toLowerCase().includes('bounce') ? 'bounced' : 'unsubscribed'} total
                    </p>
                    <Progress
                      value={Math.min(100, m.value * 5)}
                      className="h-1.5 mt-1"
                    />
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* 7-day send trend + sentiment pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div {...fadeUp} transition={{ delay: 0.2 }} className="lg:col-span-2">
          <Card className="p-6 h-full">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                7-Day Send Trend
              </CardTitle>
              <CardDescription>
                Daily outbound volume over the past week · {total7d} emails sent
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {trend.length === 0 || total7d === 0 ? (
                <EmptyState
                  icon={<Send className="h-8 w-8" />}
                  title="No sends in the last 7 days"
                  description="Start a campaign or seed demo data to populate the trend chart."
                />
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="ldTrendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={shortDate}
                        tick={{ fontSize: 12 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        stroke="hsl(var(--muted-foreground))"
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}
                        labelFormatter={(l) => shortDate(String(l))}
                        formatter={(v: number) => [`${v} sent`, 'Emails']}
                      />
                      <Area
                        type="monotone"
                        dataKey="sent"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#ldTrendFill)"
                        dot={{ r: 3, fill: '#10b981' }}
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...fadeUp} transition={{ delay: 0.25 }}>
          <Card className="p-6 h-full">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageCircle className="h-4 w-4" />
                Reply Sentiment
              </CardTitle>
              <CardDescription>{sentimentTotal} replies tagged</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {sentimentTotal === 0 ? (
                <EmptyState
                  icon={<MessageCircle className="h-8 w-8" />}
                  title="No tagged replies yet"
                  description="Replies received from leads will be auto-classified by sentiment."
                />
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={42}
                          outerRadius={70}
                          paddingAngle={2}
                          stroke="none"
                        >
                          {pieData.map((entry) => (
                            <Cell key={entry.key} fill={SENTIMENT_COLORS[entry.key]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px',
                            fontSize: '12px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-2 w-full">
                    {pieData.map((d) => (
                      <div key={d.key} className="flex items-center gap-2 text-xs">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: SENTIMENT_COLORS[d.key] }}
                        />
                        <span className="text-muted-foreground truncate">{d.name}</span>
                        <span className="font-semibold ml-auto">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent activity + Account health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div {...fadeUp} transition={{ delay: 0.3 }}>
          <Card className="p-6 h-full">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-4 w-4" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest sends and replies across all campaigns</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {activity.length === 0 ? (
                <EmptyState
                  icon={<Activity className="h-8 w-8" />}
                  title="No recent activity"
                  description="Sends and replies will stream into this feed as they happen."
                />
              ) : (
                <div className="max-h-96 overflow-y-auto ld-scroll -mx-2 px-2 space-y-1">
                  {activity.slice(0, 15).map((a, idx) => {
                    const { icon: Icon, tone } = activityIcon(a.type, a.sentiment)
                    let date: Date
                    try {
                      date = new Date(a.timestamp)
                    } catch {
                      date = new Date()
                    }
                    const rel = formatDistanceToNow(date, { addSuffix: true })
                    return (
                      <motion.div
                        key={`${a.email}-${idx}`}
                        {...fadeUp}
                        transition={{ delay: 0.3 + idx * 0.02 }}
                        className="flex items-start gap-3 rounded-lg p-2 hover:bg-muted/40 transition-colors"
                      >
                        <div className={`shrink-0 rounded-md p-1.5 ${tone}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium truncate">{a.email}</span>
                            {a.sentiment && (
                              <Badge
                                variant="outline"
                                className={`text-xs ${sentimentBadgeClass(a.sentiment) || ''}`}
                              >
                                {a.sentiment}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {a.label}
                            {a.company ? ` · ${a.company}` : ''}
                            {a.campaign ? ` · ${a.campaign}` : ''}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                          {rel}
                        </span>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...fadeUp} transition={{ delay: 0.35 }}>
          <Card className="p-6 h-full">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Mailbox className="h-4 w-4" />
                Account Health
              </CardTitle>
              <CardDescription>Daily send progress per sending account</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {accounts.length === 0 ? (
                <EmptyState
                  icon={<Mailbox className="h-8 w-8" />}
                  title="No sending accounts yet"
                  description="Add your first SMTP/IMAP account to start dispatching."
                />
              ) : (
                <div className="max-h-96 overflow-y-auto ld-scroll -mx-2 px-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="min-w-[140px]">Daily</TableHead>
                        <TableHead>Warmup</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accounts.map((a) => {
                        const pct =
                          a.dailyCap > 0
                            ? Math.min(100, Math.round((a.sentToday / a.dailyCap) * 100))
                            : 0
                        return (
                          <TableRow key={a.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-sm">{a.label}</span>
                                <span className="text-xs text-muted-foreground">{a.emailAddress}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusBadgeClass(a.status)}>
                                {a.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 min-w-[140px]">
                                <Progress value={pct} className="flex-1 h-1.5" />
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {a.sentToday}/{a.dailyCap}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={warmupBadgeClass(a.warmupState)}>
                                {a.warmupState}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Campaign summary */}
      <motion.div {...fadeUp} transition={{ delay: 0.4 }}>
        <Card className="p-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4" />
              Campaign Summary
            </CardTitle>
            <CardDescription>Top 5 most recent campaigns</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {campaigns.length === 0 ? (
              <EmptyState
                icon={<AlertCircle className="h-8 w-8" />}
                title="No campaigns yet"
                description="Create a campaign and import leads to get started."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {campaigns.slice(0, 5).map((c, idx) => (
                  <motion.div
                    key={c.id}
                    {...fadeUp}
                    transition={{ delay: 0.4 + idx * 0.05 }}
                    className="rounded-lg border p-4 flex flex-col gap-2 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">{c.name}</p>
                      <Badge variant="outline" className={statusBadgeClass(c.status)}>
                        {c.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Leads</p>
                        <p className="font-semibold">{c._count.leads}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Scheduled</p>
                        <p className="font-semibold">{c._count.scheduledEmails}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Steps</p>
                        <p className="font-semibold">{c._count.steps}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </p>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Unibox quick stat strip */}
      <motion.div {...fadeUp} transition={{ delay: 0.45 }}>
        <Card className="p-4 bg-muted/30 border-dashed">
          <CardContent className="p-0 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sprout className="h-4 w-4 text-emerald-600" />
              <span>
                {unibox?.unreadReplies ?? 0} unread replies · {unibox?.suppressedCount ?? 0} suppressed emails · {summary.utilization}% daily capacity used
              </span>
            </div>
            <span className="text-xs text-muted-foreground">Auto-refresh 30s</span>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
