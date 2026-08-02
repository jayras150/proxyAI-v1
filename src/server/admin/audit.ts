// ProxyAI — Admin Audit Helper (Milestone 3)
// Reusable audit logging for admin operations.

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export interface AuditEntry {
  adminId: string
  action: string
  resource: string
  beforeValue?: Record<string, unknown> | null
  afterValue?: Record<string, unknown> | null
  status?: string
  ipAddress?: string | null
  userAgent?: string | null
}

/**
 * Write an admin audit log entry.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  const data: Prisma.AuditLogCreateInput = {
    adminId: entry.adminId,
    action: entry.action,
    resource: entry.resource,
    status: entry.status ?? 'COMPLETED',
    ipAddress: entry.ipAddress ?? null,
    userAgent: entry.userAgent ?? null,
  }
  if (entry.beforeValue !== undefined && entry.beforeValue !== null) {
    data.beforeValue = entry.beforeValue as Prisma.InputJsonValue
  }
  if (entry.afterValue !== undefined && entry.afterValue !== null) {
    data.afterValue = entry.afterValue as Prisma.InputJsonValue
  }
  await prisma.auditLog.create({ data })
}
