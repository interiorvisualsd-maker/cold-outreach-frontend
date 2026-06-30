'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { AuthProvider, useAuth } from '@/lib/auth'
import { LoginScreen } from '@/components/login-screen'
import { AppShell, type ViewId } from '@/components/app-shell'
import { DashboardView } from '@/components/views/dashboard'
import { AccountsView } from '@/components/views/accounts'
import { CampaignsView } from '@/components/views/campaigns'
import { CsvUploadView } from '@/components/views/csv-upload'
import { DispatcherView } from '@/components/views/dispatcher'
import { WarmupView } from '@/components/views/warmup'
import { UniboxView } from '@/components/views/unibox'
import { SuppressionView } from '@/components/views/suppression'
import { SettingsView } from '@/components/views/settings'
import { TemplatesView } from '@/components/views/templates'
import { TeamView } from '@/components/views/team'

function AppContent() {
  const { user, loading } = useAuth()
  const [view, setView] = useState<ViewId>('dashboard')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!user) return <LoginScreen />

  return (
    <AppShell current={view} onNavigate={setView}>
      {view === 'dashboard' && <DashboardView />}
      {view === 'accounts' && <AccountsView />}
      {view === 'campaigns' && <CampaignsView />}
      {view === 'csv' && <CsvUploadView />}
      {view === 'dispatcher' && <DispatcherView />}
      {view === 'warmup' && <WarmupView />}
      {view === 'unibox' && <UniboxView />}
      {view === 'suppression' && <SuppressionView />}
      {view === 'settings' && <SettingsView />}
      {view === 'templates' && <TemplatesView />}
      {view === 'team' && <TeamView />}
    </AppShell>
  )
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
