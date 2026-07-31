// ProxyAI — User → UserProfile Mapping (shared)
// Single source of truth for converting a DB user row into the API profile.

import type { UserProfile } from '@/types/auth'

/**
 * Prisma `select` fragment for the fields exposed in UserProfile.
 * Spread it into any user query that needs a profile.
 */
export const userProfileSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  createdAt: true,
} as const

interface UserLike {
  id: string
  email: string
  name: string | null
  role: string
  status: string
  createdAt: Date | string
}

/**
 * Map a user row (Prisma result) to the API UserProfile shape.
 */
export function toUserProfile(user: UserLike): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    createdAt:
      typeof user.createdAt === 'string' ? user.createdAt : user.createdAt.toISOString(),
  }
}
