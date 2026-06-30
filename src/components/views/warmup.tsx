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
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts'
import {
  Flame,
  Loader2,
  RefreshCw,
  Play,
  Inbox,
  Send,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  History,
  ArrowUpRight,
  ArrowDownLeft,
  LifeBuoy,
} from 'lucide-react'
import { warmupBadgeClass, EmptyState } from './dashboard'

interface WarmupAccount {
  id: string
  label: string
  emailAddress: string
  warmupState: string
  warmupDay: number
  warmupTargetMax: number
  warmupStartQty: number
  warmupIncrement: number
  warmupSentToday: number
  status: string
}

interface WarmupStats {
  accounts: WarmupAccount[]
  summary: {
    sentToday: number
    completedToday: number
    failedToday: number
    rescuedToday: number
    activeAccounts: number
  }
}

interface WarmupHistoryPoint {
  date: string
  sent: number
  received: number
  rescued: number
}

interface WarmupHistory {
  account: { id: string; label: string; emailAddress: string }
  series: WarmupHistoryPoint[]
  summary: { totalSent: number; totalReceived: number; totalRescued: number; avgPerDay: number }
}

export function WarmupView() {
  const { toast } = useToast()
  const [stats, setStats] = useState<WarmupStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [checkingInbound, setCheckingInbound] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [historyAccountId, setHistoryAccountId] = useState<string | null>(null)
  const [history, setHistory] = useState<WarmupHistory | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      try {
        const res = await api.get<WarmupStats>('/api/warmup/stats')
        setStats(res)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        toast({ title: 'Failed to load warmup stats', description: msg, variant: 'destructive' })
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    load()
    const t = setInterval(() => load(true), 20000)
    return () => clearInterval(t)
  }, [load])

  const process = async () => {
    setProcessing(true)
    try {
      const res = await api.post<{ processed: number; sent: number; failed: number; errors: string[] }>(
        '/api/warmup/process',
      )
      toast({
        title: 'Warmup batch processed',
        description: `${res.sent} sent · ${res.failed} failed`,
        variant: res.failed > 0 ? 'destructive' : 'default',
      })
      load(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Process failed'
      toast({ title: 'Failed', description: msg, variant: 'destructive' })
    } finally {
      setProcessing(false)
    }
  }

  const checkInbound = async () => {
    setCheckingInbound(true)
    try {
      const res = await api.post<{ checked: number; rescued: number; replied: number; errors: string[] }>(
        '/api/warmup/check-inbound',
      )
      toast({
        title: 'Inbound check complete',
        description: `${res.checked} checked · ${res.rescued} rescued · ${res.replied} auto-replied`,
      })
      load(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Check failed'
      toast({ title: 'Failed', description: msg, variant: 'destructive' })
    } finally {
      setCheckingInbound(false)
    }
  }

  const toggle = async (id: string) => {
    setTogglingId(id)
    try {
      await api.post(`/api/warmup/${id}/toggle`)
      load(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Toggle failed'
      toast({ title: 'Failed', description: msg, variant: 'destructive' })
    } finally {
      setTogglingId(null)
    }
  }

  const openHistory = useCallback(
    async (accountId: string) => {
      setHistoryAccountId(accountId)
      setHistory(null)
      setHistoryLoading(true)
      try {
        const res = await api.get<WarmupHistory>(`/api/exports/warmup-history/${accountId}`)
        setHistory(res)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        toast({ title: 'Failed to load warmup history', description: msg, variant: 'destructive' })
        setHistoryAccountId(null)
      } finally {
        setHistoryLoading(false)
      }
    },
    [toast],
  )

  const closeHistory = () => {
    setHistoryAccountId(null)
    setHistory(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const summary = stats?.summary || {
    sentToday: 0,
    completedToday: 0,
    failedToday: 0,
    rescuedToday: 0,
    activeAccounts: 0,
  }
  const accounts = stats?.accounts || []

  const statCards = [
    {
      label: 'Sent Today',
      value: summary.sentToday,
      icon: Send,
      tone: 'text-emerald-600',
      sub: `${summary.activeAccounts} active accounts`,
    },
    {
      label: 'Completed Today',
      value: summary.completedToday,
      icon: ShieldCheck,
      tone: 'text-emerald-600',
      sub: 'Full warmup roundtrips',
    },
    {
      label: 'Rescued from Spam',
      value: summary.rescuedToday,
      icon: Inbox,
      tone: 'text-amber-600',
      sub: 'Auto-moved to inbox',
    },
    {
      label: 'Failed Today',
      value: summary.failedToday,
      icon: AlertTriangle,
      tone: 'text-rose-600',
      sub: 'Needs attention',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Warm-up Engine</h1>
          <p className="text-sm text-muted-foreground">Reputation building & ramp-up progress</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={checkInbound} disabled={checkingInbound}>
            {checkingInbound ? <Loader2 className="h-4 w-4 animate-spin" /> : <Inbox className="h-4 w-4" />}
            Check Inbound
          </Button>
          <Button size="sm" onClick={process} disabled={processing}>
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Process Warmup
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((c) => {
          const Icon = c.icon
          return (
            <Card key={c.label} className="card-hover p-4">
              <CardContent className="p-0 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {c.label}
                  </p>
                  <Icon className={`h-4 w-4 ${c.tone}`} />
                </div>
                <p className="text-3xl font-bold">{c.value}</p>
                <p className="text-xs text-muted-foreground">{c.sub}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Accounts with ramp-up */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-4 w-4" />
            Account Ramp-up
          </CardTitle>
          <CardDescription>
            Each account ramps volume daily until reaching its target maximum
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <EmptyState
              icon={<Flame className="h-8 w-8" />}
              title="No accounts in warm-up"
              description="Enable warm-up on your sending accounts to start building reputation."
            />
          ) : (
            <div className="max-h-[28rem] overflow-y-auto -mx-2 px-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead className="min-w-[200px]">Today / Target</TableHead>
                    <TableHead className="text-center">Ramp Curve</TableHead>
                    <TableHead className="text-center">Enabled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((a) => {
                    const todayTarget = Math.min(
                      a.warmupTargetMax,
                      a.warmupStartQty + Math.max(0, a.warmupDay - 1) * a.warmupIncrement,
                    )
                    const todayPct = todayTarget > 0 ? Math.min(100, Math.round((a.warmupSentToday / todayTarget) * 100)) : 0
                    const rampPct = Math.min(100, Math.round((a.warmupDay / Math.max(1, Math.ceil((a.warmupTargetMax - a.warmupStartQty) / a.warmupIncrement) + 1)) * 100))
                    return (
                      <TableRow
                        key={a.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => openHistory(a.id)}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium flex items-center gap-1.5">
                              {a.label}
                              <History className="h-3 w-3 text-muted-foreground" />
                            </span>
                            <span className="text-xs text-muted-foreground">{a.emailAddress}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={warmupBadgeClass(a.warmupState)}>
                            {a.warmupState}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{a.warmupDay}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2 min-w-[200px]">
                            <Progress value={todayPct} className="flex-1" />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {a.warmupSentToday}/{todayTarget}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 justify-center">
                            <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all"
                                style={{ width: `${rampPct}%` }}
                              />
                            </div>
                            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-center">
                            <Switch
                              checked={true}
                              onCheckedChange={() => toggle(a.id)}
                              disabled={togglingId === a.id}
                              aria-label="Toggle warmup"
                            />
                          </div>
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

      {/* Ramp-up explainer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How Ramp-up Works</CardTitle>
          <CardDescription>Daily volume increases until target reached</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div className="flex items-start gap-3">
            <Label className="mt-0.5 min-w-[80px] text-xs font-mono">Day 1</Label>
            <p>Start with <strong className="text-foreground">warmupStartQty</strong> peer-to-peer emails to other warm-up accounts.</p>
          </div>
          <div className="flex items-start gap-3">
            <Label className="mt-0.5 min-w-[80px] text-xs font-mono">Day 2+</Label>
            <p>Add <strong className="text-foreground">warmupIncrement</strong> emails each day, capped at <strong className="text-foreground">warmupTargetMax</strong>.</p>
          </div>
          <div className="flex items-start gap-3">
            <Label className="mt-0.5 min-w-[80px] text-xs font-mono">Inbound</Label>
            <p>Each batch polls IMAP for replies, rescues messages stuck in spam, and sends auto-replies to keep threads alive.</p>
          </div>
          <div className="flex items-start gap-3">
            <Label className="mt-0.5 min-w-[80px] text-xs font-mono">Graduated</Label>
            <p>Once an account reaches its target, it becomes <Badge variant="outline" className={warmupBadgeClass('warm')}>warm</Badge> and stays in maintenance mode.</p>
          </div>
          <div className="flex items-start gap-3 pt-2 border-t mt-2">
            <Label className="mt-0.5 min-w-[80px] text-xs font-mono flex items-center gap-1">
              <History className="h-3 w-3" /> Tip
            </Label>
            <p>Click any account row to view its 30-day warmup history chart.</p>
          </div>
        </CardContent>
      </Card>

      {/* Warmup history dialog */}
      <Dialog open={historyAccountId !== null} onOpenChange={(o) => !o && closeHistory()}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Warmup History
            </DialogTitle>
            <DialogDescription>
              {history?.account
                ? `${history.account.label} — ${history.account.emailAddress}`
                : 'Loading account…'}
            </DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
              <Skeleton className="h-64 w-full" />
            </div>
          ) : history ? (
            <div className="space-y-4">
              {/* Summary stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: 'Total Sent',
                    value: history.summary.totalSent,
                    icon: ArrowUpRight,
                    tone: 'text-emerald-600',
                    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
                  },
                  {
                    label: 'Received',
                    value: history.summary.totalReceived,
                    icon: ArrowDownLeft,
                    tone: 'text-amber-600',
                    bg: 'bg-amber-50 dark:bg-amber-900/20',
                  },
                  {
                    label: 'Rescued',
                    value: history.summary.totalRescued,
                    icon: LifeBuoy,
                    tone: 'text-rose-600',
                    bg: 'bg-rose-50 dark:bg-rose-900/20',
                  },
                  {
                    label: 'Avg / Day',
                    value: history.summary.avgPerDay,
                    icon: TrendingUp,
                    tone: 'text-slate-600',
                    bg: 'bg-slate-100 dark:bg-slate-800/50',
                  },
                ].map((s) => {
                  const Icon = s.icon
                  return (
                    <div key={s.label} className={`rounded-lg p-3 ${s.bg}`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                          {s.label}
                        </p>
                        <Icon className={`h-3.5 w-3.5 ${s.tone}`} />
                      </div>
                      <p className="text-xl font-bold">{s.value}</p>
                    </div>
                  )
                })}
              </div>

              {/* 30-day trend chart */}
              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  30-Day Trend
                </p>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={history.series}
                      margin={{ top: 5, right: 12, bottom: 0, left: -20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 9 }}
                        tickFormatter={(d: string) => d.slice(5)}
                        stroke="hsl(var(--muted-foreground))"
                        interval={4}
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
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Line
                        type="monotone"
                        dataKey="sent"
                        name="Sent"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="received"
                        name="Received"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="rescued"
                        name="Rescued"
                        stroke="#f43f5e"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={closeHistory}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No history available.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
