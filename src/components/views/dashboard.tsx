'use client'

import { useEffect, useState, useCallback } from 'react'
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
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

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

export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800'
    case 'paused':
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
    case 'suspended':
    case 'error':
      return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800'
    case 'draft':
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800'
    case 'completed':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
  }
}

export function warmupBadgeClass(state: string): string {
  switch (state) {
    case 'cold':
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
    case 'heating':
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800'
    case 'warm':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800'
    case 'paused':
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
    case 'suspended':
      return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800'
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
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

export function DashboardView() {
  const { toast } = useToast()
  const [stats, setStats] = useState<DispatcherStats | null>(null)
  const [unibox, setUnibox] = useState<UniboxStats | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      try {
        const [disp, uni, camp] = await Promise.all([
          api.get<DispatcherStats>('/api/dispatcher/stats'),
          api.get<UniboxStats>('/api/unibox/stats'),
          api.get<{ campaigns: CampaignSummary[] }>('/api/campaigns'),
        ])
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const queue = stats?.queue || { queued: 0, assigned: 0, sending: 0, sent: 0, failed: 0, cancelled: 0 }
  const summary = stats?.summary || {
    totalSentToday: 0,
    totalCapacity: 0,
    activeAccounts: 0,
    totalAccounts: 0,
    utilization: 0,
  }

  const chartData = [
    { name: 'Queued', value: queue.queued, fill: '#64748b' },
    { name: 'Assigned', value: queue.assigned, fill: '#f59e0b' },
    { name: 'Sending', value: queue.sending, fill: '#10b981' },
    { name: 'Sent', value: queue.sent, fill: '#059669' },
    { name: 'Failed', value: queue.failed, fill: '#e11d48' },
    { name: 'Cancelled', value: queue.cancelled, fill: '#94a3b8' },
  ]

  const statCards = [
    {
      label: 'Sent Today',
      value: summary.totalSentToday,
      sub: `${summary.totalCapacity} daily capacity`,
      icon: Send,
      tone: 'text-emerald-600',
    },
    {
      label: 'Queue Size',
      value: queue.queued + queue.assigned + queue.sending,
      sub: `${queue.failed} failed`,
      icon: Zap,
      tone: 'text-amber-600',
    },
    {
      label: 'Unread Replies',
      value: unibox?.unreadReplies ?? 0,
      sub: `${unibox?.totalReplies ?? 0} total`,
      icon: Inbox,
      tone: 'text-rose-600',
    },
    {
      label: 'Active Accounts',
      value: summary.activeAccounts,
      sub: `of ${summary.totalAccounts} total`,
      icon: Users,
      tone: 'text-slate-600',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Real-time overview of your lead dispatcher
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.label} className="p-4">
              <CardContent className="p-0 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {card.label}
                  </p>
                  <Icon className={`h-4 w-4 ${card.tone}`} />
                </div>
                <p className="text-3xl font-bold">{card.value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{card.sub}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Queue Status
            </CardTitle>
            <CardDescription>Distribution of scheduled emails by status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Utilization</CardTitle>
            <CardDescription>Capacity used today</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-6">
            <div className="relative h-32 w-32">
              <svg className="h-32 w-32 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke={summary.utilization > 85 ? '#e11d48' : '#10b981'}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(summary.utilization / 100) * 264} 264`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">{summary.utilization}%</span>
                <span className="text-xs text-muted-foreground">used</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {summary.totalSentToday} sent / {summary.totalCapacity} capacity
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Account health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mailbox className="h-4 w-4" />
            Account Health
          </CardTitle>
          <CardDescription>Daily send progress per account</CardDescription>
        </CardHeader>
        <CardContent>
          {stats && stats.accounts.length > 0 ? (
            <div className="max-h-96 overflow-y-auto -mx-2 px-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="min-w-[160px]">Daily Progress</TableHead>
                    <TableHead>Warmup</TableHead>
                    <TableHead className="text-right">Failures</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.accounts.map((a) => {
                    const pct =
                      a.dailyCap > 0 ? Math.min(100, Math.round((a.sentToday / a.dailyCap) * 100)) : 0
                    return (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{a.label}</span>
                            <span className="text-xs text-muted-foreground">{a.emailAddress}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadgeClass(a.status)}>
                            {a.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[160px]">
                            <Progress value={pct} className="flex-1" />
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
                        <TableCell className="text-right">
                          {a.failureStreak > 0 ? (
                            <span className="text-rose-600 font-medium">{a.failureStreak}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={<Mailbox className="h-8 w-8" />}
              title="No sending accounts yet"
              description="Add your first SMTP/IMAP account to start dispatching."
            />
          )}
        </CardContent>
      </Card>

      {/* Recent campaigns */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Recent Campaigns
          </CardTitle>
          <CardDescription>Top 5 most recent campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          {campaigns.length > 0 ? (
            <div className="space-y-2">
              {campaigns.slice(0, 5).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{c.name}</p>
                      <Badge variant="outline" className={statusBadgeClass(c.status)}>
                        {c.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c._count.leads} leads · {c._count.scheduledEmails} scheduled ·{' '}
                      {new Date(c.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<AlertCircle className="h-8 w-8" />}
              title="No campaigns yet"
              description="Create a campaign and import leads to get started."
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
