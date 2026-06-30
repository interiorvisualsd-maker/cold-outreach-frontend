'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  ShieldOff,
  Settings,
  Search,
  CornerDownLeft,
  Mail,
  Building2,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { ViewId } from './app-shell'

interface LeadResult {
  id: string
  email: string
  companyName: string | null
  website: string | null
  status: string
  currentStep: number
  campaign: { name: string } | null
}

interface CommandItem {
  id: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  action: () => void
  group: string
  keywords?: string
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (view: ViewId) => void
  onLogout?: () => void
  onLeadSelect?: (leadId: string, campaignId: string) => void
}

const NAV_COMMANDS: Array<{
  id: ViewId
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  group: string
  keywords: string
}> = [
  { id: 'dashboard', label: 'Dashboard', description: 'Analytics & deliverability overview', icon: LayoutDashboard, group: 'Navigation', keywords: 'home overview stats analytics' },
  { id: 'unibox', label: 'Unibox', description: 'Unified reply inbox', icon: Inbox, group: 'Navigation', keywords: 'replies inbox messages' },
  { id: 'campaigns', label: 'Campaigns', description: 'Email sequences & leads', icon: Send, group: 'Outreach', keywords: 'sequence leads emails' },
  { id: 'csv', label: 'Import Leads', description: 'Upload CSV & map columns', icon: FileSpreadsheet, group: 'Outreach', keywords: 'csv upload import leads' },
  { id: 'templates', label: 'Templates', description: 'Email template library', icon: FileText, group: 'Outreach', keywords: 'templates email merge fields' },
  { id: 'accounts', label: 'Sending Accounts', description: 'SMTP / IMAP manager', icon: Users, group: 'Infrastructure', keywords: 'smtp imap accounts senders' },
  { id: 'warmup', label: 'Warm-up', description: 'Reputation builder engine', icon: Flame, group: 'Infrastructure', keywords: 'warmup warm up reputation' },
  { id: 'dispatcher', label: 'Dispatcher', description: 'Queue & sending monitor', icon: Zap, group: 'Infrastructure', keywords: 'queue send dispatch' },
  { id: 'suppression', label: 'Suppression', description: 'Bounced & unsubscribed emails', icon: ShieldOff, group: 'Infrastructure', keywords: 'suppression bounce unsubscribe block' },
  { id: 'team', label: 'Team', description: 'Workspace members & roles', icon: UsersRound, group: 'Settings', keywords: 'team members users roles' },
  { id: 'settings', label: 'Settings', description: 'Config & integrations', icon: Settings, group: 'Settings', keywords: 'settings config integrations' },
]

export function CommandPalette({ open, onOpenChange, onNavigate, onLogout, onLeadSelect }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [leadResults, setLeadResults] = useState<LeadResult[]>([])
  const [searchingLeads, setSearchingLeads] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Debounced lead search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) {
      setLeadResults([])
      setSearchingLeads(false)
      return
    }
    setSearchingLeads(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get<{ results: LeadResult[] }>(`/api/extras/search/leads?q=${encodeURIComponent(query)}&limit=5`)
        setLeadResults(res.results || [])
      } catch {
        setLeadResults([])
      } finally {
        setSearchingLeads(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const navCommands: CommandItem[] = NAV_COMMANDS.map((c) => ({
    id: c.id,
    label: c.label,
    description: c.description,
    icon: c.icon,
    group: c.group,
    keywords: c.keywords,
    action: () => {
      onNavigate(c.id)
      onOpenChange(false)
    },
  }))

  const leadCommands: CommandItem[] = leadResults.map((lead) => ({
    id: `lead-${lead.id}`,
    label: lead.email,
    description: `${lead.companyName || 'Unknown company'} · ${lead.campaign?.name || 'No campaign'} · ${lead.status}`,
    icon: lead.companyName ? Building2 : Mail,
    group: 'Leads',
    action: () => {
      if (onLeadSelect && lead.campaign) {
        onLeadSelect(lead.id, lead.campaignId)
      } else {
        // Fallback: navigate to campaigns view
        onNavigate('campaigns')
      }
      onOpenChange(false)
    },
  }))

  const actionCommands: CommandItem[] = onLogout
    ? [{
        id: 'logout',
        label: 'Sign Out',
        description: 'Log out of your account',
        icon: LogOut,
        group: 'Actions',
        action: () => {
          onLogout()
          onOpenChange(false)
        },
      }]
    : []

  // When query is short, show nav + actions. When query is 2+ chars, show leads + nav (filtered).
  const allCommands = [...leadCommands, ...navCommands, ...actionCommands]
  const filtered = allCommands.filter((cmd) => {
    // Lead results always show when present (they're already server-filtered)
    if (cmd.group === 'Leads') return true
    if (!query || query.length < 2) return true
    const q = query.toLowerCase()
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q) ||
      (cmd.keywords && cmd.keywords.toLowerCase().includes(q))
    )
  })

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action()
        }
      }
    },
    [filtered, selectedIndex],
  )

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, handleKeyDown])

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery('')
      setLeadResults([])
    }
  }, [open])

  const grouped = filtered.reduce((acc, cmd) => {
    if (!acc[cmd.group]) acc[cmd.group] = []
    acc[cmd.group].push(cmd)
    return acc
  }, {} as Record<string, CommandItem[]>)

  let flatIndex = 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-xl overflow-hidden" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Command palette</DialogTitle>
        </DialogHeader>
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search views, leads, actions... (type 2+ chars to search leads)"
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
          />
          {searchingLeads && (
            <div className="h-4 w-4 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          )}
          <kbd className="hidden sm:flex h-5 items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-medium text-slate-400">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Search className="h-8 w-8 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-700">{query.length < 2 ? 'Start typing to search' : 'No results found'}</p>
              <p className="text-xs text-slate-400 mt-1">
                {query.length < 2 ? 'Type 2+ characters to search leads by email or company' : 'Try a different search term'}
              </p>
            </div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="px-2">
                <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {group}{group === 'Leads' && leadResults.length > 0 ? ` (${leadResults.length})` : ''}
                </p>
                {items.map((cmd) => {
                  const isSelected = flatIndex === selectedIndex
                  flatIndex++
                  const Icon = cmd.icon
                  return (
                    <button
                      key={cmd.id}
                      onClick={cmd.action}
                      onMouseEnter={() => setSelectedIndex(flatIndex - 1)}
                      className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors ${
                        isSelected ? 'bg-violet-100' : 'hover:bg-slate-100'
                      }`}
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                        isSelected ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${isSelected ? 'text-violet-900' : 'text-slate-900'} truncate`}>
                          {cmd.label}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{cmd.description}</p>
                      </div>
                      {isSelected && (
                        <CornerDownLeft className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <kbd className="h-4 w-4 flex items-center justify-center rounded border border-slate-300 bg-white text-[9px]">↑</kbd>
              <kbd className="h-4 w-4 flex items-center justify-center rounded border border-slate-300 bg-white text-[9px]">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="h-4 flex items-center justify-center rounded border border-slate-300 bg-white px-1 text-[9px]">↵</kbd>
              select
            </span>
          </div>
          <span className="text-[11px] text-slate-400">{filtered.length} results</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
