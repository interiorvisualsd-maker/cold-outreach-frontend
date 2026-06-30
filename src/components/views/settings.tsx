'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Settings as SettingsIcon,
  Save,
  Loader2,
  Flame,
  Plug,
  AlertTriangle,
  Trash2,
  Sparkles,
  CheckCircle2,
  XCircle,
  Info,
  Mail,
  Clock,
  Building,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────
type SettingsMap = Record<string, string>

interface TestLlmResponse {
  ok: boolean
  error?: string
  message?: string
}

interface SeedResponse {
  ok: boolean
  seeded: Record<string, number>
}

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i)

// Default warmup phrase library
const DEFAULT_PHRASES = [
  'Quick question for you',
  'Following up on my last note',
  'Worth a quick chat next week?',
  'Re: our conversation',
  'Saw your latest launch — congrats!',
  'Thought you might find this useful',
  'Loved your recent post',
  'Got 15 min this Thursday?',
].join('\n')

export function SettingsView() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<null | 'general' | 'warmup'>(null)
  const [testingLlm, setTestingLlm] = useState(false)
  const [llmStatus, setLlmStatus] = useState<null | { ok: boolean; message: string }>(null)
  const [resetting, setResetting] = useState(false)

  // General settings
  const [dailyCap, setDailyCap] = useState(80)
  const [hourlyCap, setHourlyCap] = useState(12)
  const [windowStart, setWindowStart] = useState(9)
  const [windowEnd, setWindowEnd] = useState(17)
  const [fromName, setFromName] = useState('')
  const [mailingAddress, setMailingAddress] = useState('')

  // Warm-up settings
  const [warmupPhrases, setWarmupPhrases] = useState(DEFAULT_PHRASES)
  const [warmupStartQty, setWarmupStartQty] = useState(2)
  const [warmupIncrement, setWarmupIncrement] = useState(2)
  const [warmupTargetMax, setWarmupTargetMax] = useState(20)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<{ settings: SettingsMap }>('/api/extras/settings')
      const s = res.settings || {}
      if (s['general.dailyCap']) setDailyCap(Number(s['general.dailyCap']) || 80)
      if (s['general.hourlyCap']) setHourlyCap(Number(s['general.hourlyCap']) || 12)
      if (s['general.windowStart']) setWindowStart(Number(s['general.windowStart']) || 9)
      if (s['general.windowEnd']) setWindowEnd(Number(s['general.windowEnd']) || 17)
      if (s['general.fromName']) setFromName(s['general.fromName'])
      if (s['general.mailingAddress']) setMailingAddress(s['general.mailingAddress'])
      if (s['warmup.phrases']) setWarmupPhrases(s['warmup.phrases'])
      if (s['warmup.startQty']) setWarmupStartQty(Number(s['warmup.startQty']) || 2)
      if (s['warmup.increment']) setWarmupIncrement(Number(s['warmup.increment']) || 2)
      if (s['warmup.targetMax']) setWarmupTargetMax(Number(s['warmup.targetMax']) || 20)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast({ title: 'Failed to load settings', description: msg, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const saveGeneral = async () => {
    setSaving('general')
    try {
      await api.put('/api/extras/settings', {
        'general.dailyCap': String(dailyCap),
        'general.hourlyCap': String(hourlyCap),
        'general.windowStart': String(windowStart),
        'general.windowEnd': String(windowEnd),
        'general.fromName': fromName,
        'general.mailingAddress': mailingAddress,
      })
      toast({ title: 'General settings saved' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      toast({ title: 'Failed to save', description: msg, variant: 'destructive' })
    } finally {
      setSaving(null)
    }
  }

  const saveWarmup = async () => {
    setSaving('warmup')
    try {
      await api.put('/api/extras/settings', {
        'warmup.phrases': warmupPhrases,
        'warmup.startQty': String(warmupStartQty),
        'warmup.increment': String(warmupIncrement),
        'warmup.targetMax': String(warmupTargetMax),
      })
      toast({ title: 'Warm-up settings saved' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      toast({ title: 'Failed to save', description: msg, variant: 'destructive' })
    } finally {
      setSaving(null)
    }
  }

  const testLlm = async () => {
    setTestingLlm(true)
    setLlmStatus(null)
    try {
      const res = await api.post<TestLlmResponse>('/api/extras/settings/test-llm')
      if (res.ok) {
        setLlmStatus({ ok: true, message: res.message || 'DeepSeek API key is valid' })
        toast({ title: 'LLM connection OK', description: res.message })
      } else {
        setLlmStatus({ ok: false, message: res.error || 'Unknown error' })
        toast({ title: 'LLM test failed', description: res.error, variant: 'destructive' })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Test failed'
      setLlmStatus({ ok: false, message: msg })
      toast({ title: 'LLM test failed', description: msg, variant: 'destructive' })
    } finally {
      setTestingLlm(false)
    }
  }

  const handleReset = async () => {
    setResetting(true)
    try {
      const res = await api.post<SeedResponse>('/api/extras/seed')
      toast({
        title: 'All data reset',
        description: `Reseeded: +${res.seeded?.accounts ?? 0} accounts, +${res.seeded?.campaigns ?? 0} campaigns, +${res.seeded?.leads ?? 0} leads`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reset failed'
      toast({ title: 'Reset failed', description: msg, variant: 'destructive' })
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeUp} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Global configuration, warm-up library, integrations, and danger zone
          </p>
        </div>
      </motion.div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 max-w-2xl">
          <TabsTrigger value="general" className="gap-1.5">
            <SettingsIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="warmup" className="gap-1.5">
            <Flame className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Warm-up</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-1.5">
            <Plug className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Integrations</span>
          </TabsTrigger>
          <TabsTrigger value="danger" className="gap-1.5 text-rose-600 data-[state=active]:text-rose-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Danger Zone</span>
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: General ─── */}
        <TabsContent value="general">
          <motion.div {...fadeUp}>
            <Card className="p-6">
              <CardHeader className="p-0 pb-6">
                <CardTitle className="flex items-center gap-2 text-base">
                  <SettingsIcon className="h-4 w-4" />
                  General Sending Defaults
                </CardTitle>
                <CardDescription>
                  Applied to new accounts & campaigns unless overridden per-item
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-6">
                {/* Daily cap slider */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Default Daily Cap</Label>
                    <Badge variant="outline" className="font-mono">{dailyCap} / day</Badge>
                  </div>
                  <Slider
                    value={[dailyCap]}
                    onValueChange={(v) => setDailyCap(v[0])}
                    min={50}
                    max={100}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Per-account daily send limit (50–100). Lower = safer for new domains.
                  </p>
                </div>

                <Separator />

                {/* Hourly cap */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Default Hourly Cap</Label>
                    <Badge variant="outline" className="font-mono">{hourlyCap} / hour</Badge>
                  </div>
                  <Slider
                    value={[hourlyCap]}
                    onValueChange={(v) => setHourlyCap(v[0])}
                    min={1}
                    max={30}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Prevents burst-sending that triggers spam filters.
                  </p>
                </div>

                <Separator />

                {/* Sending window */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Default Sending Window (hours, recipient local time)
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="win-start" className="text-xs text-muted-foreground">Start hour</Label>
                      <Select
                        value={String(windowStart)}
                        onValueChange={(v) => setWindowStart(Number(v))}
                      >
                        <SelectTrigger id="win-start" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HOUR_OPTIONS.map((h) => (
                            <SelectItem key={h} value={String(h)}>
                              {h.toString().padStart(2, '0')}:00
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="win-end" className="text-xs text-muted-foreground">End hour</Label>
                      <Select
                        value={String(windowEnd)}
                        onValueChange={(v) => setWindowEnd(Number(v))}
                      >
                        <SelectTrigger id="win-end" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HOUR_OPTIONS.map((h) => (
                            <SelectItem key={h} value={String(h)}>
                              {h.toString().padStart(2, '0')}:00
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* From name */}
                <div className="space-y-2">
                  <Label htmlFor="from-name" className="text-sm font-medium">Default From Name</Label>
                  <Input
                    id="from-name"
                    placeholder="Alice from Acme"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used when a campaign doesn&apos;t override it.
                  </p>
                </div>

                <Separator />

                {/* Mailing address (CAN-SPAM) */}
                <div className="space-y-2">
                  <Label htmlFor="mailing-addr" className="text-sm font-medium flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    Physical Mailing Address (CAN-SPAM requirement)
                  </Label>
                  <Textarea
                    id="mailing-addr"
                    rows={3}
                    placeholder={'Acme Inc.\n123 Main St, Suite 400\nSan Francisco, CA 94105'}
                    value={mailingAddress}
                    onChange={(e) => setMailingAddress(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Required by CAN-SPAM. Appended to the unsubscribe footer of every campaign email.
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={saveGeneral} disabled={saving === 'general'}>
                    {saving === 'general' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save General Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ─── Tab 2: Warm-up ─── */}
        <TabsContent value="warmup">
          <motion.div {...fadeUp} className="space-y-4">
            <Card className="p-6">
              <CardHeader className="p-0 pb-6">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Flame className="h-4 w-4" />
                  Warm-up Phrase Library
                </CardTitle>
                <CardDescription>
                  One phrase per line — picked at random for warm-up peer-to-peer emails
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-3">
                <Textarea
                  rows={10}
                  className="font-mono text-sm"
                  value={warmupPhrases}
                  onChange={(e) => setWarmupPhrases(e.target.value)}
                  placeholder={'Quick question for you\nFollowing up on my last note\nWorth a quick chat next week?'}
                />
                <p className="text-xs text-muted-foreground">
                  {warmupPhrases.split('\n').filter((l) => l.trim()).length} phrases · keep them casual, short, and reply-friendly
                </p>
              </CardContent>
            </Card>

            <Card className="p-6">
              <CardHeader className="p-0 pb-6">
                <CardTitle className="text-base">Default Ramp-up Schedule</CardTitle>
                <CardDescription>
                  Applied to new sending accounts when warm-up is enabled
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Start Quantity (Day 1)</Label>
                    <Badge variant="outline" className="font-mono">{warmupStartQty} / day</Badge>
                  </div>
                  <Slider
                    value={[warmupStartQty]}
                    onValueChange={(v) => setWarmupStartQty(v[0])}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Daily Increment</Label>
                    <Badge variant="outline" className="font-mono">+{warmupIncrement} / day</Badge>
                  </div>
                  <Slider
                    value={[warmupIncrement]}
                    onValueChange={(v) => setWarmupIncrement(v[0])}
                    min={1}
                    max={5}
                    step={1}
                  />
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Target Maximum</Label>
                    <Badge variant="outline" className="font-mono">{warmupTargetMax} / day</Badge>
                  </div>
                  <Slider
                    value={[warmupTargetMax]}
                    onValueChange={(v) => setWarmupTargetMax(v[0])}
                    min={5}
                    max={40}
                    step={1}
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={saveWarmup} disabled={saving === 'warmup'}>
                    {saving === 'warmup' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Warm-up Settings
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="p-6 border-dashed bg-muted/30">
              <CardContent className="p-0 flex gap-3">
                <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">How ramp-up works</p>
                  <p>
                    Each warm-up day advances automatically. Starting at <strong>{warmupStartQty}</strong> emails/day,
                    volume grows by <strong>+{warmupIncrement}</strong> per day until reaching{' '}
                    <strong>{warmupTargetMax}</strong>. A typical ramp from cold to warm takes{' '}
                    {Math.ceil((warmupTargetMax - warmupStartQty) / Math.max(1, warmupIncrement))} days.
                  </p>
                  <p>Inbound warm-up replies are rescued from spam folders and auto-replied to keep threads alive.</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ─── Tab 3: Integrations ─── */}
        <TabsContent value="integrations">
          <motion.div {...fadeUp} className="space-y-4">
            <Card className="p-6">
              <CardHeader className="p-0 pb-6">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4" />
                  DeepSeek LLM (Reply Sentiment Tagging)
                </CardTitle>
                <CardDescription>
                  Used by the Unibox inbound poller to auto-classify replies as interested / not_interested / neutral / OOO
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-4">
                <div className="rounded-lg border p-4 flex items-start gap-3">
                  <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 p-2 shrink-0">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">DeepSeek Chat API</p>
                      <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                        api.deepseek.com
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Reads <code className="text-xs">DEEPSEEK_API_KEY</code> from the backend environment. Used only server-side — never exposed to the browser.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={testLlm} disabled={testingLlm} variant="outline">
                    {testingLlm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                    Test Connection
                  </Button>
                  {llmStatus && (
                    <div
                      className={`flex items-center gap-2 text-sm ${
                        llmStatus.ok ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {llmStatus.ok ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      <span>{llmStatus.ok ? 'Connected' : 'Failed'}</span>
                      <span className="text-muted-foreground hidden sm:inline">· {llmStatus.message}</span>
                    </div>
                  )}
                </div>

                {!llmStatus && (
                  <p className="text-xs text-muted-foreground">
                    Click <strong>Test Connection</strong> to verify the API key is set and valid.
                  </p>
                )}

                <Separator />

                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground space-y-2">
                  <p className="font-medium text-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    How it works
                  </p>
                  <p>
                    When a reply lands in the Unibox, the backend sends the reply body to DeepSeek with a
                    classification prompt. The returned tag (interested / not_interested / neutral / ooo /
                    unsubscribe) is stored on the reply and surfaced in the Unibox and Dashboard.
                  </p>
                  <p className="text-xs">Without a valid key, replies still arrive — they just stay untagged.</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ─── Tab 4: Danger Zone ─── */}
        <TabsContent value="danger">
          <motion.div {...fadeUp} className="space-y-4">
            <Card className="p-6 border-rose-300 dark:border-rose-800">
              <CardHeader className="p-0 pb-6">
                <CardTitle className="flex items-center gap-2 text-base text-rose-700 dark:text-rose-400">
                  <AlertTriangle className="h-4 w-4" />
                  Danger Zone
                </CardTitle>
                <CardDescription>
                  Irreversible actions — proceed with caution
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-4">
                <div className="rounded-lg border border-rose-200 dark:border-rose-900/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">Reset All Data</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Wipes every account, campaign, lead, scheduled email, reply, warmup message, and suppression entry — then reseeds with demo data. Users are preserved.
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="shrink-0" disabled={resetting}>
                        {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Reset & Reseed
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-rose-600" />
                          Reset everything?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This will <strong>permanently delete</strong> all accounts, campaigns, leads, replies, scheduled emails, warmup messages, and suppression entries, then reseed with the demo dataset. Your user account is preserved. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-rose-600 hover:bg-rose-700 text-white"
                          onClick={handleReset}
                          disabled={resetting}
                        >
                          {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          Yes, reset everything
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">Clear All Queued Emails</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cancels every scheduled email with status <code>queued</code> or <code>assigned</code>. Already-sent emails are preserved.
                    </p>
                  </div>
                  <Button variant="outline" className="shrink-0" disabled>
                    <Info className="h-4 w-4" />
                    Coming soon
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
