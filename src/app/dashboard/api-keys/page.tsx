'use client'

// ProxyAI — API Keys Page (Milestone 5)
// List, create, rotate, and revoke API keys with one-time reveal.

import { useState, useCallback } from 'react'
import { useApiKeys, useCreateApiKey, useRevokeApiKey, useRotateApiKey } from '@/hooks/use-api-keys'
import type { ApiKeyItem } from '@/hooks/use-api-keys'
import { PageHeader } from '@/components/ui/page-header'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SearchBox } from '@/components/ui/search-box'
import { Input } from '@/components/ui/input'
import { Dialog, ConfirmDialog } from '@/components/ui/dialog'
import { Alert } from '@/components/ui/alert'
import { SkeletonCard } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/error-state'
import { formatRelativeTime } from '@/lib/format'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'REVOKED', label: 'Revoked' },
  { value: 'DISABLED', label: 'Disabled' },
]

const STATUS_TONE: Record<string, 'success' | 'danger' | 'warning'> = {
  ACTIVE: 'success',
  REVOKED: 'danger',
  DISABLED: 'warning',
}

// ─── Create Key Dialog ─────────────────────────────────────────────

function CreateKeyDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [createdKey, setCreatedKey] = useState<{ fullKey: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const createMutation = useCreateApiKey()

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!name.trim()) return

      try {
        const result = await createMutation.mutateAsync(name.trim())
        setCreatedKey({ fullKey: result.fullKey })
        setName('')
      } catch {
        // Error displayed by mutation state
      }
    },
    [name, createMutation]
  )

  const handleCopy = useCallback(() => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey.fullKey).catch(() => {})
      setCopied(true)
    }
  }, [createdKey])

  const handleDismiss = useCallback(() => {
    setCreatedKey(null)
    setCopied(false)
    setName('')
    onClose()
  }, [onClose])

  return (
    <Dialog
      open={open}
      onClose={handleDismiss}
      title={createdKey ? 'API Key Created' : 'Create API Key'}
      description={
        createdKey
          ? undefined
          : 'Give your key a descriptive name so you can identify it later.'
      }
    >
      {!createdKey ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="new-key-name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Key Name
            </label>
            <Input
              id="new-key-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My API Key"
              disabled={createMutation.isPending}
              autoFocus
            />
          </div>

          {createMutation.isError && (
            <Alert tone="danger">
              {(createMutation.error as Error)?.message ?? 'Failed to create API key.'}
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDismiss}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={createMutation.isPending}
              disabled={!name.trim()}
            >
              Generate
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <Alert tone="warning">
            <strong>Key only shown once.</strong> Copy it now. You will not be able to see it again.
          </Alert>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
            <code
              className="block break-all font-mono text-sm text-zinc-900 dark:text-zinc-100 select-all"
              data-testid="full-key"
            >
              {createdKey.fullKey}
            </code>
          </div>

          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={handleCopy} variant={copied ? 'primary' : 'secondary'}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button size="sm" variant="outline" onClick={handleDismiss}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}

// ─── Rotate Key Dialog ────────────────────────────────────────────

function RotateKeyDialog({
  open,
  onClose,
  keyItem,
}: {
  open: boolean
  onClose: () => void
  keyItem: ApiKeyItem | null
}) {
  const [showConfirm, setShowConfirm] = useState(true)
  const [rotatedKey, setRotatedKey] = useState<{ fullKey: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const rotateMutation = useRotateApiKey()

  const handleRotate = useCallback(async () => {
    if (!keyItem) return
    try {
      const result = await rotateMutation.mutateAsync(keyItem.id)
      setRotatedKey({ fullKey: result.fullKey })
      setShowConfirm(false)
    } catch {
      // Error shown in UI
    }
  }, [keyItem, rotateMutation])

  const handleCopy = useCallback(() => {
    if (rotatedKey) {
      navigator.clipboard.writeText(rotatedKey.fullKey).catch(() => {})
      setCopied(true)
    }
  }, [rotatedKey])

  const handleClose = useCallback(() => {
    setShowConfirm(true)
    setRotatedKey(null)
    setCopied(false)
    onClose()
  }, [onClose])

  if (!keyItem) return null

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={rotatedKey ? 'Key Rotated' : showConfirm ? 'Rotate API Key' : 'Key Rotated'}
      description={
        showConfirm
          ? `The current key "${keyItem.name}" will be revoked immediately and replaced with a new one.`
          : undefined
      }
    >
      {showConfirm ? (
        <div className="space-y-4">
          <Alert tone="warning">
            This action is <strong>irreversible</strong>. Any services using this key will stop working until updated.
          </Alert>

          {rotateMutation.isError && (
            <Alert tone="danger">
              {(rotateMutation.error as Error)?.message ?? 'Failed to rotate API key.'}
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={rotateMutation.isPending}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleRotate} isLoading={rotateMutation.isPending}>
              Rotate & Replace
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Alert tone="warning">
            <strong>Key only shown once.</strong> The old key has been revoked. Copy this new key now.
          </Alert>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
            <code className="block break-all font-mono text-sm text-zinc-900 dark:text-zinc-100 select-all">
              {rotatedKey?.fullKey}
            </code>
          </div>

          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={handleCopy} variant={copied ? 'primary' : 'secondary'}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button size="sm" variant="outline" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}

// ─── Delete Key Dialog ────────────────────────────────────────────

function DeleteKeyDialog({
  open,
  onClose,
  onConfirm,
  keyItem,
  isDeleting,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  keyItem: ApiKeyItem | null
  isDeleting: boolean
}) {
  if (!keyItem) return null

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Revoke API Key"
      description={`Permanently revoke "${keyItem.name}"? This cannot be undone. Any services using this key will stop working.`}
      confirmLabel="Revoke"
      isConfirming={isDeleting}
    />
  )
}

// ─── Main Page ────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ApiKeyItem | null>(null)
  const [rotateTarget, setRotateTarget] = useState<ApiKeyItem | null>(null)

  const { data: keys, isLoading, error, refetch } = useApiKeys()
  const revokeMutation = useRevokeApiKey()

  const filteredKeys = (keys ?? []).filter((key) => {
    if (search && !key.name.toLowerCase().includes(search.toLowerCase())) return false
    if (statusFilter && key.status !== statusFilter) return false
    return true
  })

  const handleRevoke = useCallback(async () => {
    if (!deleteTarget) return
    try {
      await revokeMutation.mutateAsync(deleteTarget.id)
      setDeleteTarget(null)
    } catch {
      // Error shown via mutation
    }
  }, [deleteTarget, revokeMutation])

  const handleCreateClose = useCallback(() => {
    setCreateOpen(false)
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Keys"
        description="Create, rotate and revoke your API keys."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            Create Key
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search by key name..."
            label="Search API keys"
          />
        </div>
        <div className="w-full sm:w-44">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by key status"
            className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          <SkeletonCard lines={1} />
          <SkeletonCard lines={1} />
          <SkeletonCard lines={1} />
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <ErrorState title="Failed to Load API Keys" error={error} onRetry={() => refetch()} />
      )}

      {/* Empty */}
      {!isLoading && !error && filteredKeys.length === 0 && (
        <EmptyState
          title="No API keys"
          description={
            search || statusFilter
              ? 'No API keys match your filters.'
              : 'You have no API keys yet. Create one to get started.'
          }
          action={
            !search && !statusFilter ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                Create Key
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Data — Desktop table */}
      {!isLoading && !error && filteredKeys.length > 0 && (
        <>
          <div className="hidden md:block">
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Key</TH>
                  <TH>Status</TH>
                  <TH>Created</TH>
                  <TH>Last Used</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {filteredKeys.map((key) => (
                  <TR key={key.id}>
                    <TD className="font-medium text-zinc-900 dark:text-zinc-100">{key.name}</TD>
                    <TD>
                      <code className="font-mono text-xs text-zinc-500">{key.keyPrefix}…</code>
                    </TD>
                    <TD>
                      <Badge tone={STATUS_TONE[key.status] ?? 'neutral'}>{key.status}</Badge>
                    </TD>
                    <TD className="tabular-nums text-zinc-500">{formatRelativeTime(key.createdAt)}</TD>
                    <TD className="tabular-nums text-zinc-500">
                      {key.lastUsedAt ? formatRelativeTime(key.lastUsedAt) : '—'}
                    </TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-1">
                        {key.status === 'ACTIVE' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRotateTarget(key)}
                              aria-label={`Rotate ${key.name}`}
                            >
                              Rotate
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(key)}
                              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              aria-label={`Revoke ${key.name}`}
                            >
                              Revoke
                            </Button>
                          </>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          {/* Data — Mobile cards */}
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 md:hidden">
            {filteredKeys.map((key) => (
              <div key={key.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{key.name}</p>
                    <code className="block font-mono text-xs text-zinc-500">{key.keyPrefix}…</code>
                    <div className="flex items-center gap-2">
                      <Badge tone={STATUS_TONE[key.status] ?? 'neutral'}>{key.status}</Badge>
                      <span className="text-xs text-zinc-500">
                        Created {formatRelativeTime(key.createdAt)}
                      </span>
                    </div>
                    {key.lastUsedAt && (
                      <p className="text-xs text-zinc-500">Last used {formatRelativeTime(key.lastUsedAt)}</p>
                    )}
                  </div>
                  {key.status === 'ACTIVE' && (
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRotateTarget(key)}
                      >
                        Rotate
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(key)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Revoke
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Dialogs */}
      <CreateKeyDialog open={createOpen} onClose={handleCreateClose} />
      <RotateKeyDialog
        open={!!rotateTarget}
        onClose={() => setRotateTarget(null)}
        keyItem={rotateTarget}
      />
      <DeleteKeyDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleRevoke}
        keyItem={deleteTarget}
        isDeleting={revokeMutation.isPending}
      />
    </div>
  )
}
