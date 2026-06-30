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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
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
  Send,
  Loader2,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Play,
  Pause,
  ArrowLeft,
  Mail,
  Clock,
  Users,
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

const LEAD_STATUSES = ['pending', 'step1_sent', 'step2_sent', 'step3_sent', 'replied', 'suppressed', 'bounced', 'unsubscribed']

function leadStatusBadgeClass(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
    case 'step1_sent':
    case 'step2_sent':
    case 'step3_sent':
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800'
    case 'replied':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800'
    case 'suppressed':
    case 'bounced':
    case 'unsubscribed':
      return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800'
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
  }
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

  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId)
      setLeadsPage(1)
      setLeadsStatus('all')
      loadLeads(selectedId, 1, 'all')
    }
  }, [selectedId, loadDetail, loadLeads])

  const openCampaign = (id: string) => {
    setSelectedId(id)
  }

  const backToList = () => {
    setSelectedId(null)
    setDetail(null)
    setLeads([])
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

  // ─── Detail View ───
  if (selectedId) {
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
          <div className="flex gap-2">
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
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800">
                              {num === 1 ? 'Day 0' : `Day ${step.delayDays}`}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
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

            {/* Leads */}
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Leads ({leadsTotal})
                    </CardTitle>
                    <CardDescription>Filter and inspect lead status</CardDescription>
                  </div>
                  <Select
                    value={leadsStatus}
                    onValueChange={(v) => {
                      setLeadsStatus(v)
                      setLeadsPage(1)
                      loadLeads(selectedId, 1, v)
                    }}
                  >
                    <SelectTrigger className="w-[180px]">
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
              <CardContent>
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
                            <TableHead>Email</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-center">Step</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {leads.map((l) => (
                            <TableRow key={l.id}>
                              <TableCell className="font-medium">{l.email}</TableCell>
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

        {/* Delete confirmation */}
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
