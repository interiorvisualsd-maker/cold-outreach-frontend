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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
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
  Users,
  Loader2,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Play,
  Pause,
  PlugZap,
  Mailbox,
} from 'lucide-react'
import { statusBadgeClass, warmupBadgeClass, EmptyState } from './dashboard'

interface Account {
  id: string
  label: string
  emailAddress: string
  fromName: string
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpSecure: boolean
  imapHost: string
  imapPort: number
  imapUser: string
  imapSecure: boolean
  dailyCap: number
  hourlyCap: number
  provider: string
  warmupEnabled: boolean
  warmupStartQty: number
  warmupIncrement: number
  warmupTargetMax: number
  warmupState: string
  status: string
  sentToday: number
  failureStreak: number
  lastSentAt: string | null
  createdAt: string
}

interface AccountFormState {
  label: string
  emailAddress: string
  fromName: string
  smtpHost: string
  smtpPort: string
  smtpUser: string
  smtpPass: string
  smtpSecure: boolean
  imapHost: string
  imapPort: string
  imapUser: string
  imapPass: string
  imapSecure: boolean
  dailyCap: number
  hourlyCap: string
  provider: string
  warmupEnabled: boolean
  warmupStartQty: string
  warmupIncrement: string
  warmupTargetMax: string
}

const PROVIDER_PRESETS: Record<
  string,
  { smtpHost: string; smtpPort: string; imapHost: string; imapPort: string; secure: boolean }
> = {
  gmail: {
    smtpHost: 'smtp.gmail.com',
    smtpPort: '465',
    imapHost: 'imap.gmail.com',
    imapPort: '993',
    secure: true,
  },
  outlook: {
    smtpHost: 'smtp-mail.outlook.com',
    smtpPort: '587',
    imapHost: 'outlook.office365.com',
    imapPort: '993',
    secure: false,
  },
  yahoo: {
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: '465',
    imapHost: 'imap.mail.yahoo.com',
    imapPort: '993',
    secure: true,
  },
  custom: { smtpHost: '', smtpPort: '', imapHost: '', imapPort: '', secure: true },
}

const EMPTY_FORM: AccountFormState = {
  label: '',
  emailAddress: '',
  fromName: '',
  smtpHost: '',
  smtpPort: '465',
  smtpUser: '',
  smtpPass: '',
  smtpSecure: true,
  imapHost: '',
  imapPort: '993',
  imapUser: '',
  imapPass: '',
  imapSecure: true,
  dailyCap: 50,
  hourlyCap: '10',
  provider: 'custom',
  warmupEnabled: true,
  warmupStartQty: '2',
  warmupIncrement: '2',
  warmupTargetMax: '20',
}

export function AccountsView() {
  const { toast } = useToast()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AccountFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      try {
        const res = await api.get<{ accounts: Account[] }>('/api/accounts')
        setAccounts(res.accounts || [])
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        toast({ title: 'Failed to load accounts', description: msg, variant: 'destructive' })
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setDialogOpen(true)
  }

  const openEdit = (a: Account) => {
    setForm({
      label: a.label,
      emailAddress: a.emailAddress,
      fromName: a.fromName,
      smtpHost: a.smtpHost,
      smtpPort: String(a.smtpPort),
      smtpUser: a.smtpUser,
      smtpPass: '',
      smtpSecure: a.smtpSecure,
      imapHost: a.imapHost,
      imapPort: String(a.imapPort),
      imapUser: a.imapUser,
      imapPass: '',
      imapSecure: a.imapSecure,
      dailyCap: a.dailyCap,
      hourlyCap: String(a.hourlyCap),
      provider: a.provider,
      warmupEnabled: a.warmupEnabled,
      warmupStartQty: String(a.warmupStartQty),
      warmupIncrement: String(a.warmupIncrement),
      warmupTargetMax: String(a.warmupTargetMax),
    })
    setEditingId(a.id)
    setDialogOpen(true)
  }

  const applyProvider = (provider: string) => {
    const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.custom
    setForm((f) => ({
      ...f,
      provider,
      smtpHost: preset.smtpHost || f.smtpHost,
      smtpPort: preset.smtpPort || f.smtpPort,
      imapHost: preset.imapHost || f.imapHost,
      imapPort: preset.imapPort || f.imapPort,
      smtpSecure: preset.secure,
      imapSecure: true,
    }))
  }

  const save = async () => {
    if (!form.label || !form.emailAddress || !form.fromName) {
      toast({ title: 'Missing fields', description: 'Label, email, and from name are required', variant: 'destructive' })
      return
    }
    if (!editingId && (!form.smtpPass || !form.imapPass)) {
      toast({ title: 'Missing passwords', description: 'SMTP and IMAP passwords are required for new accounts', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        label: form.label,
        emailAddress: form.emailAddress,
        fromName: form.fromName,
        smtpHost: form.smtpHost,
        smtpPort: parseInt(form.smtpPort) || 465,
        smtpUser: form.smtpUser,
        smtpSecure: form.smtpSecure,
        imapHost: form.imapHost,
        imapPort: parseInt(form.imapPort) || 993,
        imapUser: form.imapUser,
        imapSecure: form.imapSecure,
        dailyCap: form.dailyCap,
        hourlyCap: parseInt(form.hourlyCap) || 10,
        provider: form.provider,
        warmupEnabled: form.warmupEnabled,
        warmupStartQty: parseInt(form.warmupStartQty) || 2,
        warmupIncrement: parseInt(form.warmupIncrement) || 2,
        warmupTargetMax: parseInt(form.warmupTargetMax) || 20,
      }
      if (form.smtpPass) payload.smtpPass = form.smtpPass
      if (form.imapPass) payload.imapPass = form.imapPass

      if (editingId) {
        await api.put(`/api/accounts/${editingId}`, payload)
        toast({ title: 'Account updated', description: `${form.label} saved` })
      } else {
        await api.post('/api/accounts', payload)
        toast({ title: 'Account created', description: `${form.label} added` })
      }
      setDialogOpen(false)
      load(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      // Check if it's a verification error (backend returns detailed message)
      if (msg.includes('SMTP verification failed') || msg.includes('IMAP verification failed')) {
        toast({
          title: '⚠️ Account verification failed',
          description: msg + ' — Please check your credentials and try again.',
          variant: 'destructive',
        })
      } else {
        toast({ title: 'Failed to save account', description: msg, variant: 'destructive' })
      }
    } finally {
      setSaving(false)
    }
  }

  const testAccount = async (id: string) => {
    setTestingId(id)
    try {
      const res = await api.post<{ smtp: { ok: boolean; error?: string }; imap: { ok: boolean; error?: string } }>(
        `/api/accounts/${id}/test`,
      )
      const smtpStatus = res.smtp.ok ? '✓ SMTP OK' : `✗ SMTP: ${res.smtp.error || 'failed'}`
      const imapStatus = res.imap.ok ? '✓ IMAP OK' : `✗ IMAP: ${res.imap.error || 'failed'}`
      toast({
        title: 'Connection test',
        description: `${smtpStatus} · ${imapStatus}`,
        variant: res.smtp.ok && res.imap.ok ? 'default' : 'destructive',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Test failed'
      toast({ title: 'Test failed', description: msg, variant: 'destructive' })
    } finally {
      setTestingId(null)
    }
  }

  const togglePause = async (a: Account) => {
    try {
      if (a.status === 'paused') {
        await api.post(`/api/accounts/${a.id}/resume`)
        toast({ title: 'Account resumed', description: a.label })
      } else {
        await api.post(`/api/accounts/${a.id}/pause`)
        toast({ title: 'Account paused', description: a.label })
      }
      load(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Toggle failed'
      toast({ title: 'Failed', description: msg, variant: 'destructive' })
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await api.delete(`/api/accounts/${deleteId}`)
      toast({ title: 'Account deleted' })
      setDeleteId(null)
      load(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed'
      toast({ title: 'Failed', description: msg, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sending Accounts</h1>
          <p className="text-sm text-muted-foreground">SMTP/IMAP credentials, throttling & warm-up</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Account
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            All Accounts
          </CardTitle>
          <CardDescription>{accounts.length} account(s) configured</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <EmptyState
              icon={<Mailbox className="h-8 w-8" />}
              title="No sending accounts"
              description="Add your first SMTP/IMAP account to begin sending emails."
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Add Account
                </Button>
              }
            />
          ) : (
            <div className="max-h-[28rem] overflow-y-auto -mx-2 px-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="min-w-[140px]">Sent Today</TableHead>
                    <TableHead>Warmup</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((a) => {
                    const pct = a.dailyCap > 0 ? Math.min(100, Math.round((a.sentToday / a.dailyCap) * 100)) : 0
                    return (
                      <TableRow key={a.id} className="ld-row-hover">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{a.label}</span>
                            <span className="text-xs text-muted-foreground">{a.emailAddress}</span>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{a.provider}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadgeClass(a.status)}>
                            {a.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[140px]">
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
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => testAccount(a.id)}
                              disabled={testingId === a.id}
                              title="Test SMTP/IMAP"
                            >
                              {testingId === a.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <PlugZap className="h-4 w-4" />
                              )}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(a)} title="Edit">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => togglePause(a)}
                              title={a.status === 'paused' ? 'Resume' : 'Pause'}
                            >
                              {a.status === 'paused' ? (
                                <Play className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Pause className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteId(a.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-rose-600" />
                            </Button>
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Account' : 'Add Sending Account'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update account details. Leave password fields blank to keep existing credentials.'
                : 'Configure SMTP and IMAP for this sending address.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Basic */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="acc-label">Label</Label>
                <Input
                  id="acc-label"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="Gmail - alice@acme.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acc-email">Email Address</Label>
                <Input
                  id="acc-email"
                  type="email"
                  value={form.emailAddress}
                  onChange={(e) => setForm({ ...form, emailAddress: e.target.value })}
                  placeholder="alice@acme.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acc-fromname">From Name</Label>
                <Input
                  id="acc-fromname"
                  value={form.fromName}
                  onChange={(e) => setForm({ ...form, fromName: e.target.value })}
                  placeholder="Alice from Acme"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Provider</Label>
                <Select value={form.provider} onValueChange={applyProvider}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gmail">Gmail</SelectItem>
                    <SelectItem value="outlook">Outlook</SelectItem>
                    <SelectItem value="yahoo">Yahoo</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* SMTP */}
            <div>
              <p className="text-sm font-semibold mb-2">SMTP (Outbound)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-host">Host</Label>
                  <Input
                    id="smtp-host"
                    value={form.smtpHost}
                    onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-port">Port</Label>
                  <Input
                    id="smtp-port"
                    type="number"
                    value={form.smtpPort}
                    onChange={(e) => setForm({ ...form, smtpPort: e.target.value })}
                    placeholder="465"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-user">Username</Label>
                  <Input
                    id="smtp-user"
                    value={form.smtpUser}
                    onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
                    placeholder="alice@acme.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-pass">Password {editingId ? '(leave blank to keep)' : ''}</Label>
                  <Input
                    id="smtp-pass"
                    type="password"
                    value={form.smtpPass}
                    onChange={(e) => setForm({ ...form, smtpPass: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Switch
                    id="smtp-secure"
                    checked={form.smtpSecure}
                    onCheckedChange={(v) => setForm({ ...form, smtpSecure: v })}
                  />
                  <Label htmlFor="smtp-secure">Use TLS/SSL (secure)</Label>
                </div>
              </div>
            </div>

            <Separator />

            {/* IMAP */}
            <div>
              <p className="text-sm font-semibold mb-2">IMAP (Inbound)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="imap-host">Host</Label>
                  <Input
                    id="imap-host"
                    value={form.imapHost}
                    onChange={(e) => setForm({ ...form, imapHost: e.target.value })}
                    placeholder="imap.gmail.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="imap-port">Port</Label>
                  <Input
                    id="imap-port"
                    type="number"
                    value={form.imapPort}
                    onChange={(e) => setForm({ ...form, imapPort: e.target.value })}
                    placeholder="993"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="imap-user">Username</Label>
                  <Input
                    id="imap-user"
                    value={form.imapUser}
                    onChange={(e) => setForm({ ...form, imapUser: e.target.value })}
                    placeholder="alice@acme.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="imap-pass">Password {editingId ? '(leave blank to keep)' : ''}</Label>
                  <Input
                    id="imap-pass"
                    type="password"
                    value={form.imapPass}
                    onChange={(e) => setForm({ ...form, imapPass: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Switch
                    id="imap-secure"
                    checked={form.imapSecure}
                    onCheckedChange={(v) => setForm({ ...form, imapSecure: v })}
                  />
                  <Label htmlFor="imap-secure">Use TLS/SSL (secure)</Label>
                </div>
              </div>
            </div>

            <Separator />

            {/* Throttling */}
            <div>
              <p className="text-sm font-semibold mb-2">Throttling</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label>Daily Cap</Label>
                    <span className="text-sm text-muted-foreground">{form.dailyCap} emails/day</span>
                  </div>
                  <Slider
                    value={[form.dailyCap]}
                    onValueChange={(v) => setForm({ ...form, dailyCap: v[0] })}
                    min={50}
                    max={100}
                    step={5}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hourly-cap">Hourly Cap</Label>
                  <Input
                    id="hourly-cap"
                    type="number"
                    value={form.hourlyCap}
                    onChange={(e) => setForm({ ...form, hourlyCap: e.target.value })}
                    placeholder="10"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Warmup */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Warm-up Engine</p>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.warmupEnabled}
                    onCheckedChange={(v) => setForm({ ...form, warmupEnabled: v })}
                  />
                  <span className="text-sm text-muted-foreground">
                    {form.warmupEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
              {form.warmupEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="wu-start">Start Qty</Label>
                    <Input
                      id="wu-start"
                      type="number"
                      value={form.warmupStartQty}
                      onChange={(e) => setForm({ ...form, warmupStartQty: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="wu-inc">Daily Increment</Label>
                    <Input
                      id="wu-inc"
                      type="number"
                      value={form.warmupIncrement}
                      onChange={(e) => setForm({ ...form, warmupIncrement: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="wu-max">Target Max</Label>
                    <Input
                      id="wu-max"
                      type="number"
                      value={form.warmupTargetMax}
                      onChange={(e) => setForm({ ...form, warmupTargetMax: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Verifying...' : editingId ? 'Save Changes' : 'Create & Verify'}
              {editingId ? 'Save Changes' : 'Create Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the account, its encrypted credentials, and stop any
              scheduled sends using it. This action cannot be undone.
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
