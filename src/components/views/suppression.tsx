'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
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
  DialogTrigger,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ShieldOff,
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Ban,
  MailX,
  AlertTriangle,
  Download,
} from 'lucide-react'
import { EmptyState } from './dashboard'

// ─── Types ────────────────────────────────────────────────────────────
type Reason = 'bounce' | 'unsubscribe' | 'complaint' | 'manual'

interface SuppressionEntry {
  id: string
  email: string
  reason: string
  source: string | null
  createdAt: string
}

interface ByReasonRow { reason: string; _count: number }

interface SuppressionResponse {
  items: SuppressionEntry[]
  total: number
  page: number
  limit: number
  pages: number
  byReason: ByReasonRow[]
}

const REASONS: Reason[] = ['bounce', 'unsubscribe', 'complaint', 'manual']

const reasonMeta: Record<string, { label: string; className: string; icon: typeof Ban }> = {
  bounce: {
    label: 'Bounce',
    className:
      'bg-rose-100 text-rose-700 border-rose-200',
    icon: Ban,
  },
  unsubscribe: {
    label: 'Unsubscribe',
    className:
      'bg-amber-100 text-amber-700 border-amber-200',
    icon: MailX,
  },
  complaint: {
    label: 'Complaint',
    className:
      'bg-rose-100 text-rose-700 border-rose-200',
    icon: ShieldAlert,
  },
  manual: {
    label: 'Manual',
    className:
      'bg-slate-100 text-slate-700 border-slate-200',
    icon: ShieldOff,
  },
}

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
}

type FilterTab = 'all' | Reason

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'bounce', label: 'Bounce' },
  { id: 'unsubscribe', label: 'Unsubscribe' },
  { id: 'complaint', label: 'Complaint' },
  { id: 'manual', label: 'Manual' },
]

export function SuppressionView() {
  const { toast } = useToast()
  const [items, setItems] = useState<SuppressionEntry[]>([])
  const [byReason, setByReason] = useState<ByReasonRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Add dialog state
  const [addOpen, setAddOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newReason, setNewReason] = useState<Reason>('manual')
  const [newSource, setNewSource] = useState('')
  const [adding, setAdding] = useState(false)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      try {
        const reasonParam = filter === 'all' ? '' : `&reason=${filter}`
        const res = await api.get<SuppressionResponse>(
          `/api/extras/suppression?page=${page}&limit=50${reasonParam}`,
        )
        setItems(res.items || [])
        setTotal(res.total)
        setPages(res.pages)
        setByReason(res.byReason || [])
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        toast({ title: 'Failed to load suppression list', description: msg, variant: 'destructive' })
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [filter, page, toast],
  )

  useEffect(() => {
    load()
  }, [load])

  // Reset page when filter changes
  useEffect(() => {
    setPage(1)
  }, [filter])

  const handleAdd = async () => {
    const email = newEmail.trim().toLowerCase()
    if (!email) {
      toast({ title: 'Email required', variant: 'destructive' })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: 'Invalid email', description: 'Enter a valid email address', variant: 'destructive' })
      return
    }
    setAdding(true)
    try {
      await api.post('/api/extras/suppression', {
        email,
        reason: newReason,
        source: newSource.trim() || null,
      })
      toast({ title: 'Entry added', description: `${email} suppressed (${newReason})` })
      setAddOpen(false)
      setNewEmail('')
      setNewReason('manual')
      setNewSource('')
      load(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Add failed'
      toast({ title: 'Failed to add entry', description: msg, variant: 'destructive' })
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string, email: string) => {
    try {
      await api.delete(`/api/extras/suppression/${id}`)
      toast({ title: 'Entry removed', description: `${email} unblocked` })
      load(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed'
      toast({ title: 'Failed to remove', description: msg, variant: 'destructive' })
    }
  }

  const countFor = (reason: string): number =>
    byReason.find((r) => r.reason === reason)?._count ?? 0

  const exportCsv = async () => {
    setExporting(true)
    try {
      await downloadCsv(
        '/api/exports/export/suppression',
        `suppression-${new Date().toISOString().slice(0, 10)}.csv`,
      )
      toast({ title: 'Suppression list exported', description: 'CSV download started' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed'
      toast({ title: 'Export failed', description: msg, variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const statCards = [
    {
      label: 'Total',
      value: total,
      icon: ShieldOff,
      tone: 'text-slate-600',
      bg: 'bg-slate-100',
    },
    {
      label: 'Bounces',
      value: countFor('bounce'),
      icon: Ban,
      tone: 'text-rose-600',
      bg: 'bg-rose-50',
    },
    {
      label: 'Unsubscribes',
      value: countFor('unsubscribe'),
      icon: MailX,
      tone: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Complaints',
      value: countFor('complaint'),
      icon: ShieldAlert,
      tone: 'text-rose-600',
      bg: 'bg-rose-50',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        {...fadeUp}
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppression List</h1>
          <p className="text-sm text-muted-foreground">
            Manage emails blocked from receiving campaigns — bounces, unsubscribes, complaints
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Add Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Suppression Entry</DialogTitle>
                <DialogDescription>
                  Manually block an email from receiving future campaigns.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="supp-email">Email Address</Label>
                  <Input
                    id="supp-email"
                    type="email"
                    placeholder="someone@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supp-reason">Reason</Label>
                  <Select
                    value={newReason}
                    onValueChange={(v) => setNewReason(v as Reason)}
                  >
                    <SelectTrigger id="supp-reason" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REASONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {reasonMeta[r].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supp-source">Source (optional)</Label>
                  <Input
                    id="supp-source"
                    placeholder="Campaign name or note"
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)} disabled={adding}>
                  Cancel
                </Button>
                <Button onClick={handleAdd} disabled={adding}>
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add Entry
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.label}
              {...fadeUp}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className="card-hover p-4">
                <CardContent className="p-0 flex items-center gap-3">
                  <div className={`rounded-lg p-2.5 ${card.bg}`}>
                    <Icon className={`h-4 w-4 ${card.tone}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      {card.label}
                    </p>
                    <p className="text-2xl font-bold leading-none mt-1">{card.value}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Filter tabs */}
      <motion.div {...fadeUp} transition={{ delay: 0.1 }}>
        <Card className="p-2">
          <div className="flex flex-wrap gap-1">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filter === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Table */}
      <motion.div {...fadeUp} transition={{ delay: 0.15 }}>
        <Card className="p-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldOff className="h-4 w-4" />
              Suppressed Emails ({total})
            </CardTitle>
            <CardDescription>
              {filter === 'all'
                ? 'All entries across every reason'
                : `Filtered by: ${reasonMeta[filter]?.label ?? filter}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={<ShieldOff className="h-8 w-8" />}
                title="No suppressed emails"
                description={
                  filter === 'all'
                    ? 'When an email bounces, unsubscribes, or complains, it will appear here.'
                    : `No ${reasonMeta[filter]?.label ?? filter} entries yet.`
                }
                action={
                  <Button size="sm" variant="outline" onClick={() => setFilter('all')}>
                    View all entries
                  </Button>
                }
              />
            ) : (
              <>
                <div className="max-h-96 overflow-y-auto ld-scroll -mx-2 px-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Added</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((entry, idx) => {
                        const meta = reasonMeta[entry.reason] ?? reasonMeta.manual
                        const Icon = meta.icon
                        let date: Date
                        try {
                          date = new Date(entry.createdAt)
                        } catch {
                          date = new Date()
                        }
                        return (
                          <motion.tr
                            key={entry.id}
                            {...fadeUp}
                            transition={{ delay: idx * 0.02 }}
                            className="ld-row-hover"
                          >
                            <TableCell className="font-medium text-sm">{entry.email}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`gap-1 ${meta.className}`}>
                                <Icon className="h-3 w-3" />
                                {meta.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {entry.source || '—'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(date, { addSuffix: true })}
                            </TableCell>
                            <TableCell className="text-right">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8 w-8 p-0"
                                    title="Remove"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="flex items-center gap-2">
                                      <AlertTriangle className="h-5 w-5 text-rose-600" />
                                      Remove suppression entry?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will allow <strong>{entry.email}</strong> to receive future campaigns again. Only do this if you are sure the email is now valid and the recipient has consented.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-rose-600 hover:bg-rose-700 text-white"
                                      onClick={() => handleDelete(entry.id, entry.email)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </motion.tr>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                {pages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t mt-3">
                    <span className="text-xs text-muted-foreground">
                      Page {page} of {pages} · {total} entries
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        Prev
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={page >= pages}
                        onClick={() => setPage((p) => Math.min(pages, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
