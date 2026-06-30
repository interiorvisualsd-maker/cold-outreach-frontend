'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '@/lib/auth'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  LayoutDashboard,
  Send,
  Flame,
  Inbox,
  Users,
  UsersRound,
  FileSpreadsheet,
  FileText,
  LogOut,
  Zap,
  Menu,
  X,
  ShieldOff,
  Settings,
  Bell,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  Check,
  Trash2,
  Loader2,
  Sparkles,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type ViewId =
  | 'dashboard'
  | 'accounts'
  | 'campaigns'
  | 'csv'
  | 'dispatcher'
  | 'warmup'
  | 'unibox'
  | 'suppression'
  | 'settings'
  | 'templates'
  | 'team'

interface NavItem {
  id: ViewId
  label: string
  icon: ReactNode
  group: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-[18px] w-[18px]" />, group: 'Overview' },
  { id: 'unibox', label: 'Unibox', icon: <Inbox className="h-[18px] w-[18px]" />, group: 'Overview' },
  { id: 'campaigns', label: 'Campaigns', icon: <Send className="h-[18px] w-[18px]" />, group: 'Outreach' },
  { id: 'csv', label: 'Import Leads', icon: <FileSpreadsheet className="h-[18px] w-[18px]" />, group: 'Outreach' },
  { id: 'templates', label: 'Templates', icon: <FileText className="h-[18px] w-[18px]" />, group: 'Outreach' },
  { id: 'accounts', label: 'Sending Accounts', icon: <Users className="h-[18px] w-[18px]" />, group: 'Infrastructure' },
  { id: 'warmup', label: 'Warm-up', icon: <Flame className="h-[18px] w-[18px]" />, group: 'Infrastructure' },
  { id: 'dispatcher', label: 'Dispatcher', icon: <Zap className="h-[18px] w-[18px]" />, group: 'Infrastructure' },
  { id: 'suppression', label: 'Suppression', icon: <ShieldOff className="h-[18px] w-[18px]" />, group: 'Infrastructure' },
  { id: 'team', label: 'Team', icon: <UsersRound className="h-[18px] w-[18px]" />, group: 'Settings' },
  { id: 'settings', label: 'Settings', icon: <Settings className="h-[18px] w-[18px]" />, group: 'Settings' },
]

const GROUP_ORDER = ['Overview', 'Outreach', 'Infrastructure', 'Settings']

// ─── Notifications dropdown ───────────────────────────────────────────
interface Notification {
  id: string
  type: string
  severity: string
  title: string
  message: string
  read: boolean
  createdAt: string
}

function severityIcon(sev: string) {
  switch (sev) {
    case 'success':
      return { icon: CheckCircle, tone: 'text-emerald-600', bg: 'bg-emerald-50' }
    case 'warning':
      return { icon: AlertTriangle, tone: 'text-amber-600', bg: 'bg-amber-50' }
    case 'error':
      return { icon: XCircle, tone: 'text-rose-600', bg: 'bg-rose-50' }
    case 'info':
    default:
      return { icon: Info, tone: 'text-slate-600', bg: 'bg-slate-100' }
  }
}

function NotificationsDropdown() {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const res = await api.get<{ notifications: Notification[]; unreadCount: number }>(
          '/api/extras/notifications',
        )
        setNotifications(res.notifications || [])
        setUnreadCount(res.unreadCount || 0)
      } catch (err: unknown) {
        if (!silent) {
          const msg = err instanceof Error ? err.message : 'Unknown error'
          toast({ title: 'Failed to load notifications', description: msg, variant: 'destructive' })
        }
      } finally {
        setLoading(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    load(true)
    const t = setInterval(() => load(true), 60_000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    if (open) load(false)
  }, [open, load])

  const handleMarkRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    setUnreadCount((prev) => Math.max(0, prev - 1))
    try {
      await api.post(`/api/extras/notifications/${id}/read`)
    } catch {
      load(true)
    }
  }

  const handleMarkAllRead = async () => {
    setMarkingAll(true)
    try {
      await api.post('/api/extras/notifications/read-all')
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {
      // silent
    } finally {
      setMarkingAll(false)
    }
  }

  const handleDelete = async (id: string) => {
    const target = notifications.find((n) => n.id === id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    if (target && !target.read) setUnreadCount((prev) => Math.max(0, prev - 1))
    try {
      await api.delete(`/api/extras/notifications/${id}`)
    } catch {
      load(true)
    }
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await api.post('/api/extras/notifications/seed-demo')
      await load(true)
      toast({ title: 'Demo notifications seeded' })
    } catch {
      // silent
    } finally {
      setSeeding(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(380px,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">Notifications</p>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleMarkAllRead} disabled={markingAll || unreadCount === 0}>
            {markingAll ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
            Mark all read
          </Button>
        </div>
        <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-2">
          <span className="text-xs text-slate-500">{notifications.length} total</span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleSeed} disabled={seeding}>
            {seeding ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
            Seed Demo
          </Button>
        </div>
        {loading ? (
          <div className="p-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="rounded-full bg-slate-100 p-3 text-slate-400 mb-3">
              <Bell className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-slate-700">No notifications yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-[260px]">
              You&apos;ll see replies, bounces, and alerts here. Click Seed Demo to populate samples.
            </p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((n) => {
              const { icon: Icon, tone, bg } = severityIcon(n.severity)
              return (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => !n.read && handleMarkRead(n.id)}
                  className={cn(
                    'group relative flex gap-3 px-4 py-3 border-b last:border-b-0 cursor-pointer transition-colors',
                    n.read ? 'bg-white hover:bg-slate-50' : 'bg-violet-50/50 hover:bg-violet-50',
                  )}
                >
                  <div className={cn('rounded-lg p-1.5 shrink-0', bg)}>
                    <Icon className={cn('h-4 w-4', tone)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm leading-tight', n.read ? 'font-medium text-slate-700' : 'font-semibold text-slate-900')}>
                      {n.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{n.message}</p>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <button
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-600 shrink-0"
                    onClick={(e) => { e.stopPropagation(); handleDelete(n.id) }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

// ─── Sidebar nav section ──────────────────────────────────────────────
function NavSection({ group, items, current, onNavigate }: { group: string; items: NavItem[]; current: ViewId; onNavigate: (id: ViewId) => void }) {
  return (
    <div className="px-3 py-2">
      <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group}</p>
      <div className="space-y-0.5">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all',
              current === item.id
                ? 'bg-violet-100 text-violet-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

interface AppShellProps {
  current: ViewId
  onNavigate: (view: ViewId) => void
  children: ReactNode
}

export function AppShell({ current, onNavigate, children }: AppShellProps) {
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const activeItem = NAV_ITEMS.find((n) => n.id === current)

  const handleNav = (id: ViewId) => {
    onNavigate(id)
    setMobileOpen(false)
  }

  const groupedItems = GROUP_ORDER.map((group) => ({
    group,
    items: NAV_ITEMS.filter((n) => n.group === group),
  }))

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 px-5 border-b border-slate-200">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-sm">
          <Zap className="h-4 w-4" fill="currentColor" />
        </div>
        <div>
          <p className="text-[15px] font-bold text-slate-900 leading-tight">Lead Dispatcher</p>
          <p className="text-[11px] text-slate-400 leading-tight">Cold email automation</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {groupedItems.map(({ group, items }) => (
          <NavSection key={group} group={group} items={items} current={current} onNavigate={handleNav} />
        ))}
      </nav>

      {/* User card at bottom */}
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-violet-100 text-violet-700 text-xs font-semibold">
              {user?.name?.slice(0, 2).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="flex h-screen bg-white">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-slate-50 border-r border-slate-200">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-slate-50 border-r border-slate-200 flex flex-col">
            <button
              className="absolute right-3 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">{activeItem?.label || 'Dashboard'}</h1>
              <p className="text-xs text-slate-400 hidden sm:block">{activeItem?.group}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <NotificationsDropdown />
            <div className="h-6 w-px bg-slate-200 mx-2" />
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-violet-100 text-violet-700 text-xs font-semibold">
                  {user?.name?.slice(0, 2).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="h-4 w-4 text-slate-400 hidden sm:block" />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto bg-slate-50/50">
          <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
