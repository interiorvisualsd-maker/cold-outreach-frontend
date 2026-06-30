'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Loader2,
  RefreshCw,
  Eye,
  Variable,
  Check,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────
interface Template {
  id: string
  name: string
  subject: string
  body: string
  category: string
  mergeFields: string[]
  createdAt: string
  updatedAt: string
}

interface MergeFieldDef {
  field: string
  desc: string
}

// Sample data used for client-side preview rendering.
const SAMPLE_DATA: Record<string, string> = {
  first_name: 'Jordan',
  last_name: 'Lee',
  company_name: 'Acme Corp',
  website: 'acme.com',
  state: 'California',
  industry: 'SaaS',
  sender_name: 'Alice from Acme',
  sender_email: 'alice@acme.com',
}

const CATEGORIES = [
  { value: 'outreach', label: 'Outreach' },
  { value: 'followup', label: 'Follow-up' },
  { value: 'warmup', label: 'Warm-up' },
  { value: 'custom', label: 'Custom' },
] as const

const CATEGORY_BADGE: Record<string, string> = {
  outreach: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  followup: 'bg-amber-100 text-amber-700 border-amber-200',
  warmup: 'bg-teal-100 text-teal-700 border-teal-200',
  custom: 'bg-slate-100 text-slate-700 border-slate-200',
}

function detectMergeFields(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g) || []
  return [...new Set(matches.map((m) => m.replace(/\{\{|}\}/g, '')))]
}

function renderPreview(text: string): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, field) => SAMPLE_DATA[field] || `{{${field}}}`)
}

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
}

// ─── Component ────────────────────────────────────────────────────────
export function TemplatesView() {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<Template[]>([])
  const [availableFields, setAvailableFields] = useState<MergeFieldDef[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Template | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<string>('outreach')
  const [activeField, setActiveField] = useState<'subject' | 'body'>('body')

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Cursor-position tracking for merge-field insertion
  const subjectRef = useRef<HTMLInputElement | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      try {
        const res = await api.get<{ templates: Template[]; availableMergeFields: MergeFieldDef[] }>(
          '/api/extras/templates',
        )
        setTemplates(res.templates || [])
        setAvailableFields(res.availableMergeFields || [])
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        toast({ title: 'Failed to load templates', description: msg, variant: 'destructive' })
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

  // Live merge field detection
  const subjectFields = useMemo(() => detectMergeFields(subject), [subject])
  const bodyFields = useMemo(() => detectMergeFields(body), [body])
  const allFields = useMemo(
    () => [...new Set([...subjectFields, ...bodyFields])],
    [subjectFields, bodyFields],
  )

  const previewSubject = useMemo(() => renderPreview(subject), [subject])
  const previewBody = useMemo(() => renderPreview(body), [body])

  const openNew = () => {
    setEditing(null)
    setName('')
    setSubject('')
    setBody('')
    setCategory('outreach')
    setDialogOpen(true)
  }

  const openEdit = (t: Template) => {
    setEditing(t)
    setName(t.name)
    setSubject(t.subject)
    setBody(t.body)
    setCategory(t.category)
    setDialogOpen(true)
  }

  const insertMergeField = (field: string) => {
    const token = `{{${field}}}`
    if (activeField === 'subject' && subjectRef.current) {
      const el = subjectRef.current
      const start = el.selectionStart ?? subject.length
      const end = el.selectionEnd ?? subject.length
      const next = subject.slice(0, start) + token + subject.slice(end)
      setSubject(next)
      // Restore cursor position after the inserted token
      requestAnimationFrame(() => {
        el.focus()
        const pos = start + token.length
        el.setSelectionRange(pos, pos)
      })
    } else if (bodyRef.current) {
      const el = bodyRef.current
      const start = el.selectionStart ?? body.length
      const end = el.selectionEnd ?? body.length
      const next = body.slice(0, start) + token + body.slice(end)
      setBody(next)
      requestAnimationFrame(() => {
        el.focus()
        const pos = start + token.length
        el.setSelectionRange(pos, pos)
      })
    } else {
      // Fallback — append to body
      setBody((b) => `${b}${token}`)
    }
  }

  const handleSave = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      toast({ title: 'Missing fields', description: 'Name, subject, and body are required.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      if (editing) {
        const res = await api.put<{ template: Template }>(`/api/extras/templates/${editing.id}`, {
          name, subject, body, category,
        })
        setTemplates((prev) => prev.map((t) => (t.id === editing.id ? res.template : t)))
        toast({ title: 'Template updated', description: `"${res.template.name}" saved.` })
      } else {
        const res = await api.post<{ template: Template }>('/api/extras/templates', {
          name, subject, body, category,
        })
        setTemplates((prev) => [...prev, res.template])
        toast({ title: 'Template created', description: `"${res.template.name}" added to library.` })
      }
      setDialogOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      toast({ title: 'Save failed', description: msg, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/api/extras/templates/${deleteTarget.id}`)
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id))
      toast({ title: 'Template deleted', description: `"${deleteTarget.name}" removed.` })
      setDeleteTarget(null)
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Delete failed'
      toast({ title: 'Delete failed', description: msg, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  // ─── Loading skeleton ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        {...fadeUp}
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-slate-600" />
            Email Templates
          </h1>
          <p className="text-sm text-muted-foreground">
            Reusable outreach templates with merge-field support · {templates.length} total
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" />
            New Template
          </Button>
        </div>
      </motion.div>

      {/* Empty state */}
      {templates.length === 0 ? (
        <motion.div {...fadeUp}>
          <Card className="p-10">
            <CardContent className="p-0 flex flex-col items-center justify-center text-center">
              <div className="rounded-full bg-muted p-4 text-muted-foreground mb-4">
                <FileText className="h-8 w-8" />
              </div>
              <p className="text-lg font-semibold">No templates yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Create reusable email templates with merge fields like <code className="rounded bg-muted px-1 py-0.5 text-xs">{'{{first_name}}'}</code> and <code className="rounded bg-muted px-1 py-0.5 text-xs">{'{{company_name}}'}</code> to keep your outreach consistent and personalized.
              </p>
              <Button className="mt-5" onClick={openNew}>
                <Plus className="h-4 w-4" />
                Create your first template
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t, idx) => (
            <motion.div key={t.id} {...fadeUp} transition={{ delay: idx * 0.04 }}>
              <Card className="card-hover p-5 h-full flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{t.name}</p>
                    <Badge variant="outline" className={`mt-1 ${CATEGORY_BADGE[t.category] || CATEGORY_BADGE.custom}`}>
                      {t.category}
                    </Badge>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(t)}
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      onClick={() => setDeleteTarget(t)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subject</p>
                  <p className="text-sm font-medium line-clamp-1">{t.subject}</p>
                </div>
                <div className="space-y-1.5 flex-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Body</p>
                  <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-line">{t.body}</p>
                </div>
                {t.mergeFields.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1 border-t">
                    {t.mergeFields.map((f) => (
                      <Badge key={f} variant="secondary" className="text-xs font-mono">
                        <Variable className="h-3 w-3 mr-1" />
                        {f}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Updated {formatDistanceToNow(new Date(t.updatedAt), { addSuffix: true })}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* New / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {editing ? 'Edit Template' : 'New Template'}
            </DialogTitle>
            <DialogDescription>
              Use merge fields like <code className="rounded bg-muted px-1 py-0.5 text-xs">{'{{first_name}}'}</code> — they will be replaced with lead data when the email is sent.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 overflow-y-auto pr-1 flex-1">
            {/* ─── Form ─── */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tpl-name">Name</Label>
                <Input
                  id="tpl-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. SaaS founders — cold intro"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tpl-category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="tpl-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tpl-subject">Subject</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => { setActiveField('subject'); subjectRef.current?.focus() }}
                  >
                    {activeField === 'subject' ? <Check className="h-3 w-3 mr-1 text-emerald-600" /> : null}
                    {activeField === 'subject' ? 'Active target' : 'Set as target'}
                  </Button>
                </div>
                <Input
                  id="tpl-subject"
                  ref={subjectRef}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  onFocus={() => setActiveField('subject')}
                  placeholder="Quick question about {{company_name}}"
                />
                {subjectFields.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {subjectFields.map((f) => (
                      <Badge key={f} variant="secondary" className="text-xs font-mono">
                        <Variable className="h-3 w-3 mr-1" />
                        {f}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tpl-body">Body</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => { setActiveField('body'); bodyRef.current?.focus() }}
                  >
                    {activeField === 'body' ? <Check className="h-3 w-3 mr-1 text-emerald-600" /> : null}
                    {activeField === 'body' ? 'Active target' : 'Set as target'}
                  </Button>
                </div>
                <Textarea
                  id="tpl-body"
                  ref={bodyRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onFocus={() => setActiveField('body')}
                  placeholder={`Hi {{first_name}},\n\nNoticed {{company_name}} is in the {{industry}} space…`}
                  rows={8}
                />
                {bodyFields.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {bodyFields.map((f) => (
                      <Badge key={f} variant="secondary" className="text-xs font-mono">
                        <Variable className="h-3 w-3 mr-1" />
                        {f}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                      <Variable className="h-4 w-4" />
                      Insert Merge Field
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      Inserts into: <span className="text-foreground font-semibold">{activeField}</span>
                    </div>
                    {availableFields.map((f) => (
                      <DropdownMenuItem
                        key={f.field}
                        onClick={() => insertMergeField(f.field)}
                        className="flex flex-col items-start gap-0.5"
                      >
                        <span className="font-mono text-xs">{'{{' + f.field + '}}'}</span>
                        <span className="text-xs text-muted-foreground">{f.desc}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <span className="text-xs text-muted-foreground">
                  Cursor goes into the {activeField} field.
                </span>
              </div>
            </div>

            {/* ─── Live Preview ─── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Live Preview</p>
                <span className="text-xs text-muted-foreground ml-auto">with sample data</span>
              </div>
              <Card className="p-4 bg-muted/30">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subject</p>
                    <p className="text-sm font-medium">
                      {previewSubject || <span className="text-muted-foreground italic">Subject preview will appear here…</span>}
                    </p>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Body</p>
                    <p className="text-sm whitespace-pre-line text-foreground/90">
                      {previewBody || <span className="text-muted-foreground italic">Body preview will appear here…</span>}
                    </p>
                  </div>
                </div>
              </Card>
              {allFields.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium mb-1">Detected merge fields ({allFields.length}):</p>
                  <div className="flex flex-wrap gap-1">
                    {allFields.map((f) => (
                      <Badge key={f} variant="secondary" className="text-xs font-mono">
                        {f}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-medium mb-1">Sample data used for preview:</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono">
                  {Object.entries(SAMPLE_DATA).map(([k, v]) => (
                    <span key={k} className="truncate">
                      <span className="text-muted-foreground">{k}:</span> {v}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim() || !subject.trim() || !body.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-medium text-foreground">"{deleteTarget?.name}"</span>. Templates already in queued emails are unaffected — only future sends will lose this template. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Delete Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
