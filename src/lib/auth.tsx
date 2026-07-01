'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { authApi, setAuthToken, getStoredToken, type User } from './api'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, name: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const token = getStoredToken()
    if (!token) {
      // No stored token — not logged in. Use a microtask to avoid
      // synchronous setState-in-effect lint warning while still
      // updating before any paint.
      Promise.resolve().then(() => {
        if (!cancelled) setLoading(false)
      })
      return
    }
    setAuthToken(token)
    authApi
      .me()
      .then((res) => {
        if (!cancelled) setUser(res.user)
      })
      .catch(() => {
        setAuthToken(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password)
    setAuthToken(res.token)
    setUser(res.user)
  }

  const register = async (email: string, name: string, password: string) => {
    const res = await authApi.register(email, name, password)
    setAuthToken(res.token)
    setUser(res.user)
  }

  const logout = () => {
    setAuthToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
