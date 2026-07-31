'use client'

// ProxyAI — Auth Context (Client-side)
// Blueprint Reference: Sprint 6 — Authentication
// Tokens live in HttpOnly cookies — this context only tracks the user profile.

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { UserProfile } from '@/types/auth'

interface AuthState {
  user: UserProfile | null
  isLoading: boolean
  isAuthenticated: boolean
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string) => Promise<void>
  logout: () => Promise<void>
  logoutAll: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  })

  // Restore session on mount: /me first, then /refresh as fallback.
  useEffect(() => {
    let ignore = false

    async function bootstrap() {
      try {
        const meRes = await fetch('/api/auth/me')
        if (meRes.ok) {
          const data = await meRes.json()
          if (!ignore && data.success) {
            setState({ user: data.data, isLoading: false, isAuthenticated: true })
            return
          }
        }

        const refreshRes = await fetch('/api/auth/refresh', { method: 'POST' })
        if (refreshRes.ok) {
          const data = await refreshRes.json()
          if (!ignore && data.success) {
            setState({ user: data.data.user, isLoading: false, isAuthenticated: true })
            return
          }
        }

        if (!ignore) {
          setState({ user: null, isLoading: false, isAuthenticated: false })
        }
      } catch {
        if (!ignore) {
          setState({ user: null, isLoading: false, isAuthenticated: false })
        }
      }
    }

    bootstrap()
    return () => {
      ignore = true
    }
  }, [])

  async function login(email: string, password: string) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()
    if (!data.success) {
      throw new Error(data.message || 'Login failed')
    }

    setState({ user: data.data.user, isLoading: false, isAuthenticated: true })
  }

  async function register(email: string, password: string, name?: string) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    })

    const data = await res.json()
    if (!data.success) {
      throw new Error(data.message || 'Registration failed')
    }

    setState({ user: data.data.user, isLoading: false, isAuthenticated: true })
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Local cleanup even if the API call fails
    }
    setState({ user: null, isLoading: false, isAuthenticated: false })
  }

  async function logoutAll() {
    try {
      await fetch('/api/auth/logout-all', { method: 'POST' })
    } catch {
      // Local cleanup even if the API call fails
    }
    setState({ user: null, isLoading: false, isAuthenticated: false })
  }

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, logoutAll }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
