'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  Users,
  Loader2,
  RefreshCw,
  UserPlus,
  Shield,
  Crown,
  MoreHorizontal,
  Trash2,
  ArrowUpDown,
  Info,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────
interface TeamMember {
  id: string
  email: string
  name: string
  role: string
  createdAt: string
}

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
}

function roleBadgeClass(role: string): string {
  return role === 'admin'
    ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800'
    : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
}

function initials(name: string): string {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ─── Component ────────────────────────────────────────────────────────
export function TeamView() {
  const { toast } = useToast()
  const { user: currentUser } = useAuth()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [roleTarget, setRoleTarget] = useState<TeamMember | null>(null)
  const [pendingRole, setPendingRole] = useState<'admin' | 'member' | null>(null)
  const [updatingRole, setUpdatingRole] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      try {
        const res = await api.get<{ users: TeamMember[] }>('/api/extras/team')
        setMembers(res.users || [])
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        toast({ title: 'Failed to load team', description: msg, variant: 'destructive' })
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

  const handleRoleChange = async () => {
    if (!roleTarget || !pendingRole) return
    setUpdatingRole(true)
    try {
      const res = await api.put<{ user: TeamMember }>(`/api/extras/team/${roleTarget.id}/role`, {
        role: pendingRole,
      })
      setMembers((prev) => prev.map((m) => (m.id === roleTarget.id ? res.user : m)))
      toast({
        title: 'Role updated',
        description: `${res.user.name} is now ${res.user.role}.`,
      })
      setRoleTarget(null)
      setPendingRole(null)
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Update failed'
      toast({ title: 'Role change failed', description: msg, variant: 'destructive' })
    } finally {
      setUpdatingRole(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/api/extras/team/${deleteTarget.id}`)
      setMembers((prev) => prev.filter((m) => m.id !== deleteTarget.id))
      toast({
        title: 'Member removed',
        description: `${deleteTarget.name} no longer has access.`,
      })
      setDeleteTarget(null)
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Delete failed'
      toast({ title: 'Cannot remove member', description: msg, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const adminCount = members.filter((m) => m.role === 'admin').length

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <Skeleton className="h-64 w-full" />
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
            <Users className="h-6 w-6 text-slate-600" />
            Team Members
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage who has access to this workspace · {members.length} member{members.length === 1 ? '' : 's'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </motion.div>

      {/* Members table */}
      <motion.div {...fadeUp} transition={{ delay: 0.05 }}>
        <Card className="p-0 overflow-hidden">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-600" />
              Workspace Members
            </CardTitle>
            <CardDescription>
              {members.length} total · {adminCount} admin{adminCount === 1 ? '' : 's'} · {members.length - adminCount} member{members.length - adminCount === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {members.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="rounded-full bg-muted p-3 text-muted-foreground mb-3">
                  <Users className="h-6 w-6" />
                </div>
                <p className="font-medium">No members found</p>
                <p className="text-sm text-muted-foreground mt-1">This shouldn&apos;t happen — at least you should be here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m) => {
                      const isYou = currentUser?.id === m.id
                      const isLastUser = members.length === 1
                      return (
                        <TableRow key={m.id} className="ld-row-hover">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className="text-xs bg-slate-100 dark:bg-slate-800">
                                  {initials(m.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-medium truncate flex items-center gap-1.5">
                                  {m.name}
                                  {isYou && (
                                    <Badge variant="secondary" className="text-xs">You</Badge>
                                  )}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{m.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={roleBadgeClass(m.role)}>
                              {m.role === 'admin' ? <Shield className="h-3 w-3 mr-1" /> : null}
                              {m.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(m.createdAt), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  disabled={m.role === 'admin'}
                                  onClick={() => {
                                    setRoleTarget(m)
                                    setPendingRole('admin')
                                  }}
                                >
                                  <Shield className="h-4 w-4" />
                                  Make admin
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={m.role === 'member'}
                                  onClick={() => {
                                    setRoleTarget(m)
                                    setPendingRole('member')
                                  }}
                                >
                                  <ArrowUpDown className="h-4 w-4" />
                                  Demote to member
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  disabled={isLastUser}
                                  onClick={() => setDeleteTarget(m)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Remove member
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
      </motion.div>

      {/* Invite info card */}
      <motion.div {...fadeUp} transition={{ delay: 0.1 }}>
        <Card className="p-5 border-dashed">
          <CardContent className="p-0 flex flex-col sm:flex-row items-start gap-4">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-3 text-emerald-600 shrink-0">
              <UserPlus className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold flex items-center gap-2">
                Invite new members
                <Badge variant="secondary" className="text-xs">Self-serve</Badge>
              </p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                There&apos;s no invite-link system in this private workspace. To add a teammate, ask them to open the login screen and use <span className="font-medium text-foreground">Create Account</span> — the first account becomes the workspace admin, and every subsequent account is created as a member with full access to shared campaigns, accounts, and replies.
              </p>
              <div className="mt-3 flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Tip: After they sign up, return here to promote them to <span className="font-medium text-foreground">admin</span> if they need to manage other members or change workspace settings.
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Role change confirm */}
      <AlertDialog open={!!roleTarget && !!pendingRole} onOpenChange={(o) => !o && setRoleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Change {roleTarget?.name}&apos;s role to {pendingRole}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRole === 'admin' ? (
                <>
                  Admins can manage team members, change roles, and remove others from the workspace. {roleTarget?.name} will have full administrative access.
                </>
              ) : (
                <>
                  Members can use all sending features but cannot manage team membership or change roles. {roleTarget?.name} will lose administrative access.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updatingRole}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleRoleChange()
              }}
              disabled={updatingRole}
            >
              {updatingRole ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Confirm Role Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-medium text-foreground">{deleteTarget?.email}</span> from the workspace. Their campaigns, scheduled emails, and replies will remain, but they will no longer be able to sign in. This cannot be undone.
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
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
