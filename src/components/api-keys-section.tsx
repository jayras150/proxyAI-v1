'use client'

// ProxyAI — API Keys Management Section
// Blueprint Reference: Sprint 5 — API Keys UI
// Auth via HttpOnly cookies (no manual Authorization header needed).

import { useState, useEffect, FormEvent } from 'react'

interface ApiKeyItem {
  id: string
  name: string
  keyPrefix: string
  status: string
  lastUsedAt: string | null
  createdAt: string
}

async function fetchKeys(): Promise<ApiKeyItem[]> {
  const res = await fetch('/api/api-keys')
  const data = await res.json()
  if (!data.success) {
    throw new Error(data.message || 'Failed to load API keys.')
  }
  return data.data
}

export function ApiKeySection() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    fetchKeys()
      .then((data) => {
        if (!ignore) setKeys(data)
      })
      .catch(() => {
        if (!ignore) setError('Failed to load API keys.')
      })
      .finally(() => {
        if (!ignore) setIsLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [])

  async function refreshKeys() {
    try {
      const data = await fetchKeys()
      setKeys(data)
    } catch {
      setError('Failed to refresh API keys.')
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!newKeyName.trim()) return

    setError('')
    setCreatedKey(null)

    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      })
      const data = await res.json()

      if (data.success) {
        setCreatedKey(data.data.fullKey)
        setNewKeyName('')
        setShowCreate(false)
        await refreshKeys()
      } else {
        setError(data.message || 'Failed to create API key.')
      }
    } catch {
      setError('Failed to create API key.')
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this API key? This action cannot be undone.')) return

    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        await refreshKeys()
      } else {
        setError(data.message || 'Failed to revoke API key.')
      }
    } catch {
      setError('Failed to revoke API key.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">API Keys</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Manage your API keys for accessing ProxyAI.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 text-sm rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
        >
          Create Key
        </button>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400 rounded-lg border border-red-200">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Create Key Form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-3">
          <div>
            <label htmlFor="key-name" className="block text-sm font-medium mb-1">
              Key Name
            </label>
            <input
              id="key-name"
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="My API Key"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
            >
              Generate
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Created Key (shown once) */}
      {createdKey && (
        <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 space-y-2">
          <p className="text-sm font-medium text-green-800 dark:text-green-300">
            Key created successfully!
          </p>
          <p className="text-xs text-green-700 dark:text-green-400">
            Copy this key now. You will not be able to see it again.
          </p>
          <div className="flex gap-2">
            <code className="flex-1 p-2 rounded bg-white dark:bg-zinc-900 border border-green-200 dark:border-green-800 text-sm font-mono break-all">
              {createdKey}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(createdKey)
                setCreatedKey(null)
              }}
              className="px-3 py-1.5 text-sm rounded bg-green-600 text-white hover:bg-green-700"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Keys List */}
      {isLoading ? (
        <div className="text-center py-8 text-zinc-500">Loading...</div>
      ) : keys.length === 0 ? (
        <div className="text-center py-8 text-zinc-500 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
          No API keys yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{key.name}</p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-500">
                  <code className="font-mono">{key.keyPrefix}...</code>
                  <span>&middot;</span>
                  <span className={key.status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}>
                    {key.status}
                  </span>
                  {key.lastUsedAt && (
                    <>
                      <span>&middot;</span>
                      <span>Last used {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                    </>
                  )}
                </div>
              </div>
              {key.status === 'ACTIVE' && (
                <button
                  onClick={() => handleRevoke(key.id)}
                  className="text-sm text-red-600 hover:text-red-700 px-2 py-1"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
