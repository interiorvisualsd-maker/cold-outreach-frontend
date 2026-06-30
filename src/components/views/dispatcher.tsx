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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Zap,
  Loader2,
  RefreshCw,
  Play,
  RotateCcw,
  Clock,
  Mail,
  AlertTriangle,
} from 'lucide-react'
import { statusBadgeClass, warmupBadgeClass, EmptyState } from './dashboard'

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

interface QueueItem {
  id: string
  status: string
  subject: string
  scheduledAt: string
  sentAt: string | null
  lead: { email: string; companyName: string | null }
  campaign: { name: string }
}

interface QueueResponse {
  items: QueueItem[]
  total: number
  page: number
  limit: number
  pages: number
}

const QUEUE_STATUSES = ['queued', 'assigned', 'sending', 'sent', 'failed', 'cancelled', 'skipped']

function queueStatusBadgeClass(status: string): string {
  switch (status) {
    case 'queued':
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
    case 'assigned':
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800'
    case 'sending':
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800'
    case 'sent':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800'
    case 'failed':
      return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800'
    case 'cancelled':
    case 'skipped':
      return 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
  }
}

export function DispatcherView() {
  const { toast } = useToast()
  const [stats, setStats] = useState<DispatcherStats | null>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [queueTotal, setQueueTotal] = useState(0)
  const [queuePage, setQueuePage] = useState(1)
  const [queuePages, setQueuePages] = useState(1)
  const [queueStatus, setQueueStatus] = useState<string>('queued')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [queueLoading, setQueueLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetting, setResetting] = useState(false)

  const loadStats = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      try {
        const res = await api.get<DispatcherStats>('/api/dispatcher/stats')
        setStats(res)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        toast({ title: 'Failed to load stats', description: msg, variant: 'destructive' })
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [toast],
  )

  const loadQueue = useCallback(
    async (page: number, status: string) => {
      setQueueLoading(true)
      try {
        const query = `page=${page}&limit=50${status !== 'all' ? `&status=${status}` : ''}`
        const res = await api.get<QueueResponse>(`/api/dispatcher/queue?${query}`)
        setQueue(res.items || [])
        setQueueTotal(res.total)
        setQueuePage(res.page)
        setQueuePages(res.pages)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        toast({ title: 'Failed to load queue', description: msg, variant: 'destructive' })
      } finally {
        setQueueLoading(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    loadStats()
    loadQueue(1, 'queued')
    const t = setInterval(() => {
      loadStats(true)
      loadQueue(queuePage, queueStatus)
    }, 15000)
    return () => clearInterval(t)
  }, [])

  const onStatusChange = (status: string) => {
    setQueueStatus(status)
    setQueuePage(1)
    loadQueue(1, status)
  }

  const processNow = async () => {
    setProcessing(true)
    try {
      const res = await api.post<{
        processed: number
        sent: number
        failed: number
        skipped: number
        errors: string[]
      }>('/api/dispatcher/process')
      toast({
        title: 'Process complete',
        description: `${res.sent} sent · ${res.failed} failed · ${res.skipped} skipped`,
        variant: res.failed > 0 ? 'destructive' : 'default',
      })
      loadStats(true)
      loadQueue(queuePage, queueStatus)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Process failed'
      toast({ title: 'Failed', description: msg, variant: 'destructive' })
    } finally {
      setProcessing(false)
    }
  }

  const resetDaily = async () => {
    setResetting(true)
    try {
      await api.post('/api/dispatcher/reset-daily')
      toast({ title: 'Daily counters reset', description: 'All accounts set to 0 sent today' })
      setResetOpen(false)
      loadStats(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reset failed'
      toast({ title: 'Failed', description: msg, variant: 'destructive' })
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const queueStats = stats?.queue || { queued: 0, assigned: 0, sending: 0, sent: 0, failed: 0, cancelled: 0 }
  const summary = stats?.summary || {
    totalSentToday: 0,
    totalCapacity: 0,
    activeAccounts: 0,
    totalAccounts: 0,
    utilization: 0,
  }

  const statCards = [
    {
      label: 'Queued',
      value: queueStats.queued,
      icon: Clock,
      tone: 'text-slate-600',
      sub: 'Waiting to send',
    },
    {
      label: 'Sending',
      value: queueStats.assigned + queueStats.sending,
      icon: Zap,
      tone: 'text-amber-600',
      sub: `${queueStats.sent} sent total`,
    },
    {
      label: 'Failed',
      value: queueStats.failed,
      icon: AlertTriangle,
      tone: 'text-rose-600',
      sub: `${queueStats.cancelled} cancelled`,
    },
    {
      label: 'Utilization',
      value: `${summary.utilization}%`,
      icon: RotateCcw,
      tone: 'text-emerald-600',
      sub: `${summary.totalSentToday}/${summary.totalCapacity} today`,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dispatcher</h1>
          <p className="text-sm text-muted-foreground">Queue, sending stats & account health</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { loadStats(true); loadQueue(queuePage, queueStatus) }} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
            <RotateCcw className="h-4 w-4" />
            Reset Daily
          </Button>
          <Button size="sm" onClick={processNow} disabled={processing}>
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Process Now
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((c) => {
          const Icon = c.icon
          return (
            <Card key={c.label} className="p-4">
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

      {/* Account health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Account Health
          </CardTitle>
          <CardDescription>Per-account daily send progress</CardDescription>
        </CardHeader>
        <CardContent>
          {stats && stats.accounts.length > 0 ? (
            <div className="max-h-80 overflow-y-auto -mx-2 px-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="min-w-[160px]">Daily Progress</TableHead>
                    <TableHead>Warmup</TableHead>
                    <TableHead className="text-right">Last Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.accounts.map((a) => {
                    const pct = a.dailyCap > 0 ? Math.min(100, Math.round((a.sentToday / a.dailyCap) * 100)) : 0
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
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {a.lastSentAt ? new Date(a.lastSentAt).toLocaleTimeString() : '—'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={<Mail className="h-8 w-8" />}
              title="No sending accounts"
              description="Add accounts in the Sending Accounts tab to see health here."
            />
          )}
        </CardContent>
      </Card>

      {/* Queue */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Send Queue ({queueTotal})
              </CardTitle>
              <CardDescription>Scheduled emails across all campaigns</CardDescription>
            </div>
            <Select value={queueStatus} onValueChange={onStatusChange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {QUEUE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {queueLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : queue.length === 0 ? (
            <EmptyState
              icon={<Zap className="h-8 w-8" />}
              title="Queue is empty"
              description={`No ${queueStatus !== 'all' ? queueStatus : ''} emails right now. Start a campaign to populate the queue.`}
            />
          ) : (
            <>
              <div className="max-h-96 overflow-y-auto -mx-2 px-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Lead</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queue.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {q.subject}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs">{q.lead.email}</span>
                            {q.lead.companyName && (
                              <span className="text-xs text-muted-foreground">{q.lead.companyName}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{q.campaign.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(q.scheduledAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {q.sentAt ? new Date(q.sentAt).toLocaleString() : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={queueStatusBadgeClass(q.status)}>
                            {q.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between mt-3 text-sm">
                <span className="text-muted-foreground">
                  Page {queuePage} of {Math.max(1, queuePages)}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={queuePage <= 1 || queueLoading}
                    onClick={() => {
                      const p = queuePage - 1
                      setQueuePage(p)
                      loadQueue(p, queueStatus)
                    }}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={queuePage >= queuePages || queueLoading}
                    onClick={() => {
                      const p = queuePage + 1
                      setQueuePage(p)
                      loadQueue(p, queueStatus)
                    }}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset daily counters?</AlertDialogTitle>
            <AlertDialogDescription>
              This will set sentToday and warmupSentToday to 0 for all accounts. Normally this
              happens automatically at midnight.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={resetDaily} disabled={resetting}>
              {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
