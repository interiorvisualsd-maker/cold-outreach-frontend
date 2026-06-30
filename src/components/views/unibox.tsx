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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Inbox,
  Loader2,
  RefreshCw,
  Mail,
  Send,
  MailOpen,
  ArrowUp,
  ArrowDown,
  Building2,
  User,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { EmptyState } from './dashboard'

interface ReplyListItem {
  id: string
  fromEmail: string
  toEmail: string
  subject: string
  body: string
  receivedAt: string
  isRead: boolean
  sentiment: string | null
  lead: {
    id: string
    email: string
    companyName: string | null
    status: string
    campaign: { name: string } | null
  }
}

interface ReplyDetail extends ReplyListItem {
  lead: {
    id: string
    email: string
    companyName: string | null
    status: string
    campaign: { name: string } | null
    scheduledEmails: Array<{
      subject: string
      body: string
      sentAt: string
      stepNumber: number
    }>
    replies: Array<{
      id: string
      fromEmail: string
      toEmail: string
      subject: string
      body: string
      receivedAt: string
      sentiment: string | null
    }>
  }
}

interface ReplyListResponse {
  replies: ReplyListItem[]
  total: number
  page: number
  limit: number
  pages: number
}

interface UniboxStats {
  totalReplies: number
  unreadReplies: number
  repliedToday: number
  suppressedCount: number
}

interface Account {
  id: string
  label: string
  emailAddress: string
  status: string
}

function relativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString()
}

function sentimentBadgeClass(sentiment: string | null): string | null {
  if (!sentiment) return null
  switch (sentiment) {
    case 'interested':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800'
    case 'not_interested':
      return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800'
    case 'ooo':
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
    case 'unsubscribe':
      return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800'
    case 'neutral':
    default:
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800'
  }
}

export function UniboxView() {
  const { toast } = useToast()
  const [replies, setReplies] = useState<ReplyListItem[]>([])
  const [stats, setStats] = useState<UniboxStats | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ReplyDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [checkingInbound, setCheckingInbound] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [fromAccountId, setFromAccountId] = useState<string>('')
  const [replySubject, setReplySubject] = useState('')
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)

  const loadList = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      try {
        const query = `page=${page}&limit=50${unreadOnly ? '&unread=true' : ''}`
        const [listRes, statsRes] = await Promise.all([
          api.get<ReplyListResponse>(`/api/unibox/replies?${query}`),
          api.get<UniboxStats>('/api/unibox/stats'),
        ])
        setReplies(listRes.replies || [])
        setTotal(listRes.total)
        setPages(listRes.pages)
        setStats(statsRes)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        toast({ title: 'Failed to load replies', description: msg, variant: 'destructive' })
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [page, unreadOnly, toast],
  )

  useEffect(() => {
    loadList()
  }, [loadList])

  // Load accounts for the composer dropdown
  useEffect(() => {
    api
      .get<{ accounts: Account[] }>('/api/accounts')
      .then((res) => {
        setAccounts(res.accounts || [])
        if (res.accounts.length > 0 && !fromAccountId) {
          setFromAccountId(res.accounts[0].id)
        }
      })
      .catch(() => {
        // ignore
      })
  }, [fromAccountId])

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true)
      setSelectedId(id)
      try {
        const res = await api.get<{ reply: ReplyDetail }>(`/api/unibox/replies/${id}`)
        setDetail(res.reply)
        // Pre-fill reply subject
        const subj = res.reply.subject || ''
        setReplySubject(subj.toLowerCase().startsWith('re:') ? subj : `Re: ${subj}`)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        toast({ title: 'Failed to load thread', description: msg, variant: 'destructive' })
      } finally {
        setDetailLoading(false)
      }
    },
    [toast],
  )

  const checkInbound = async () => {
    setCheckingInbound(true)
    try {
      const res = await api.post<{ checked: number; newReplies: number; sequencesBroken: number; suppressed: number; errors: string[] }>(
        '/api/unibox/check-inbound',
      )
      toast({
        title: 'Inbound check complete',
        description: `${res.newReplies} new · ${res.sequencesBroken} sequences broken · ${res.suppressed} suppressed`,
      })
      loadList(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Check failed'
      toast({ title: 'Failed', description: msg, variant: 'destructive' })
    } finally {
      setCheckingInbound(false)
    }
  }

  const sendReply = async () => {
    if (!selectedId || !detail) return
    if (!fromAccountId) {
      toast({ title: 'Select a sending account', variant: 'destructive' })
      return
    }
    if (!replyText.trim()) {
      toast({ title: 'Reply text required', variant: 'destructive' })
      return
    }
    setSending(true)
    try {
      await api.post(`/api/unibox/replies/${selectedId}/reply`, {
        fromAccountId,
        subject: replySubject,
        text: replyText,
      })
      toast({ title: 'Reply sent', description: `To ${detail.fromEmail}` })
      setReplyText('')
      loadList(true)
      loadDetail(selectedId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Send failed'
      toast({ title: 'Failed', description: msg, variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  // Build merged thread (outbound scheduledEmails + inbound replies) in chronological order
  const thread: Array<
    | { type: 'outbound'; sentAt: string; subject: string; body: string; stepNumber: number }
    | { type: 'inbound'; receivedAt: string; subject: string; body: string; fromEmail: string; sentiment: string | null }
  > = []
  if (detail) {
    for (const se of detail.lead.scheduledEmails || []) {
      thread.push({
        type: 'outbound',
        sentAt: se.sentAt,
        subject: se.subject,
        body: se.body,
        stepNumber: se.stepNumber,
      })
    }
    for (const r of detail.lead.replies || []) {
      thread.push({
        type: 'inbound',
        receivedAt: r.receivedAt,
        subject: r.subject,
        body: r.body,
        fromEmail: r.fromEmail,
        sentiment: r.sentiment,
      })
    }
    thread.sort((a, b) => {
      const aDate = new Date(a.type === 'outbound' ? a.sentAt : a.receivedAt).getTime()
      const bDate = new Date(b.type === 'outbound' ? b.sentAt : b.receivedAt).getTime()
      return aDate - bDate
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Unibox</h1>
          <p className="text-sm text-muted-foreground">Unified reply inbox with thread context</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => loadList(true)} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button size="sm" onClick={checkInbound} disabled={checkingInbound}>
            {checkingInbound ? <Loader2 className="h-4 w-4 animate-spin" /> : <Inbox className="h-4 w-4" />}
            Check Inbound
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <CardContent className="p-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Replies</p>
            <p className="text-2xl font-bold mt-1">{stats?.totalReplies ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="p-4">
          <CardContent className="p-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Unread</p>
            <p className="text-2xl font-bold mt-1 text-rose-600">{stats?.unreadReplies ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="p-4">
          <CardContent className="p-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Replied Today</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{stats?.repliedToday ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="p-4">
          <CardContent className="p-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Suppressed</p>
            <p className="text-2xl font-bold mt-1 text-slate-600">{stats?.suppressedCount ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Master-detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* List pane */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Inbox className="h-4 w-4" />
                Replies ({total})
              </CardTitle>
              <Button
                size="sm"
                variant={unreadOnly ? 'default' : 'outline'}
                onClick={() => {
                  setUnreadOnly((v) => !v)
                  setPage(1)
                }}
              >
                {unreadOnly ? 'Unread Only' : 'All'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : replies.length === 0 ? (
              <EmptyState
                icon={<Inbox className="h-8 w-8" />}
                title="No replies"
                description="When leads reply, their messages will appear here."
              />
            ) : (
              <div className="max-h-[32rem] lg:max-h-[36rem] overflow-y-auto border-t">
                {replies.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => loadDetail(r.id)}
                    className={`w-full text-left p-3 border-b hover:bg-muted/50 transition-colors ${
                      selectedId === r.id ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {!r.isRead && (
                            <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" aria-label="Unread" />
                          )}
                          <p className={`text-sm truncate ${!r.isRead ? 'font-bold' : 'font-medium'}`}>
                            {r.fromEmail}
                          </p>
                        </div>
                        <p className={`text-sm truncate mt-0.5 ${!r.isRead ? 'font-semibold' : 'text-muted-foreground'}`}>
                          {r.subject || '(no subject)'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {r.body.slice(0, 80)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {relativeTime(r.receivedAt)}
                        </span>
                        {r.sentiment && (
                          <Badge variant="outline" className={`text-xs ${sentimentBadgeClass(r.sentiment) || ''}`}>
                            {r.sentiment}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
                {pages > 1 && (
                  <div className="flex items-center justify-between p-2 border-t bg-muted/30">
                    <span className="text-xs text-muted-foreground">
                      Page {page} of {pages}
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
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail pane */}
        <Card className="lg:col-span-2">
          {!selectedId ? (
            <CardContent className="p-0">
              <EmptyState
                icon={<MailOpen className="h-8 w-8" />}
                title="No reply selected"
                description="Select a reply from the list to view the full thread and compose a response."
              />
            </CardContent>
          ) : detailLoading ? (
            <CardContent className="p-0">
              <div className="flex justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            </CardContent>
          ) : detail ? (
            <>
              <CardHeader className="border-b">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{detail.subject || '(no subject)'}</CardTitle>
                    <CardDescription className="mt-1">
                      From <strong>{detail.fromEmail}</strong> · {new Date(detail.receivedAt).toLocaleString()}
                    </CardDescription>
                  </div>
                  {detail.sentiment && (
                    <Badge variant="outline" className={sentimentBadgeClass(detail.sentiment) || ''}>
                      {detail.sentiment}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Lead info */}
                <div className="rounded-md border bg-muted/30 p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Lead:</span>
                      <span className="font-medium">{detail.lead.email}</span>
                    </div>
                    {detail.lead.companyName && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Company:</span>
                        <span className="font-medium">{detail.lead.companyName}</span>
                      </div>
                    )}
                    {detail.lead.campaign && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Campaign:</span>
                        <span className="font-medium">{detail.lead.campaign.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant="outline">{detail.lead.status}</Badge>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Thread */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Thread ({thread.length})</p>
                  {thread.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No thread history.</p>
                  ) : (
                    <div className="max-h-96 overflow-y-auto space-y-3 pr-1">
                      {thread.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex gap-2 ${msg.type === 'outbound' ? 'justify-start' : 'justify-end'}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-lg p-3 text-sm ${
                              msg.type === 'outbound'
                                ? 'bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800'
                                : 'bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-1 text-xs font-medium">
                                {msg.type === 'outbound' ? (
                                  <>
                                    <ArrowUp className="h-3 w-3 text-emerald-600" />
                                    <span>Outbound · Step {msg.stepNumber}</span>
                                  </>
                                ) : (
                                  <>
                                    <ArrowDown className="h-3 w-3 text-amber-600" />
                                    <span>Inbound · {msg.fromEmail}</span>
                                  </>
                                )}
                              </div>
                              {msg.type === 'inbound' && msg.sentiment && (
                                <Badge variant="outline" className={`text-xs ${sentimentBadgeClass(msg.sentiment) || ''}`}>
                                  {msg.sentiment}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs font-medium mb-1">{msg.subject}</p>
                            <p className="text-xs whitespace-pre-wrap text-muted-foreground">{msg.body}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(msg.type === 'outbound' ? msg.sentAt : msg.receivedAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Composer */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Reply
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="reply-account">From Account</Label>
                      <Select value={fromAccountId} onValueChange={setFromAccountId}>
                        <SelectTrigger id="reply-account" className="w-full">
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.label} — {a.emailAddress}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reply-subject">Subject</Label>
                      <Input
                        id="reply-subject"
                        value={replySubject}
                        onChange={(e) => setReplySubject(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reply-text">Message</Label>
                    <Textarea
                      id="reply-text"
                      rows={5}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply…"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={sendReply} disabled={sending || !fromAccountId}>
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Send Reply
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="p-0">
              <EmptyState
                icon={<AlertCircle className="h-8 w-8" />}
                title="Reply not found"
                description="This reply may have been deleted."
              />
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}
