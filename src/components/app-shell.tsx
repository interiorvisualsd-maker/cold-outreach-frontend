'use client'

import { useState, type ReactNode } from 'react'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  LayoutDashboard,
  Mailbox,
  Send,
  Flame,
  Inbox,
  Users,
  FileSpreadsheet,
  LogOut,
  Zap,
  Menu,
  X,
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

interface NavItem {
  id: ViewId
  label: string
  icon: ReactNode
  description: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, description: 'Overview & analytics' },
  { id: 'accounts', label: 'Sending Accounts', icon: <Users className="h-4 w-4" />, description: 'SMTP / IMAP manager' },
  { id: 'campaigns', label: 'Campaigns', icon: <Send className="h-4 w-4" />, description: 'Sequences & leads' },
  { id: 'csv', label: 'Import CSV', icon: <FileSpreadsheet className="h-4 w-4" />, description: 'Upload & map leads' },
  { id: 'dispatcher', label: 'Dispatcher', icon: <Zap className="h-4 w-4" />, description: 'Queue & sending' },
  { id: 'warmup', label: 'Warm-up Engine', icon: <Flame className="h-4 w-4" />, description: 'Reputation builder' },
  { id: 'unibox', label: 'Unibox', icon: <Inbox className="h-4 w-4" />, description: 'Unified replies' },
]

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

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4 gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Zap className="h-4 w-4" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold leading-none">Lead Dispatcher</p>
              <p className="text-xs text-muted-foreground">Private workspace</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {activeItem && (
              <div className="hidden md:block text-right">
                <p className="text-sm font-medium leading-none">{activeItem.label}</p>
                <p className="text-xs text-muted-foreground">{activeItem.description}</p>
              </div>
            )}
            <div className="h-6 w-px bg-border hidden md:block" />
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {user?.name?.slice(0, 2).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block">
                <p className="text-xs font-medium leading-none">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={logout} title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar — desktop */}
        <aside className="hidden md:flex w-60 flex-col border-r bg-background">
          <nav className="flex-1 p-3 space-y-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  current === item.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="p-3 border-t">
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Backend</p>
              <p>Port 3001 · Local worker</p>
              <p className="mt-1">Tick: every 2 min</p>
            </div>
          </div>
        </aside>

        {/* Sidebar — mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <aside className="relative w-64 bg-background border-r flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <span className="font-semibold">Navigation</span>
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <nav className="flex-1 p-3 space-y-1">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      current === item.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-auto">
          <div className="container mx-auto max-w-7xl p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t bg-background mt-auto">
        <div className="container mx-auto max-w-7xl px-4 py-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Lead Dispatcher · Private internal tool</span>
          <span className="hidden sm:inline">Vercel + Cloud Run · SQLite dev / Neon prod</span>
        </div>
      </footer>
    </div>
  )
}
