// ProxyAI — RBAC Permissions Tests (Milestone 1)

import { describe, it, expect } from 'vitest'
import {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getPermissionsForRole,
  isAdminRole,
} from '../permissions'
import type { AdminPermission } from '../permissions'

describe('RBAC Permissions', () => {
  describe('hasPermission', () => {
    it('grants admin:access to SUPER_ADMIN', () => {
      expect(hasPermission('SUPER_ADMIN', 'admin:access')).toBe(true)
    })

    it('grants admin:access to ADMIN', () => {
      expect(hasPermission('ADMIN', 'admin:access')).toBe(true)
    })

    it('grants admin:access to SUPPORT', () => {
      expect(hasPermission('SUPPORT', 'admin:access')).toBe(true)
    })

    it('grants admin:access to READ_ONLY', () => {
      expect(hasPermission('READ_ONLY', 'admin:access')).toBe(true)
    })

    it('denies admin:access to USER', () => {
      expect(hasPermission('USER', 'admin:access')).toBe(false)
    })

    it('grants admin:users:write to SUPER_ADMIN', () => {
      expect(hasPermission('SUPER_ADMIN', 'admin:users:write')).toBe(true)
    })

    it('denies admin:users:write to SUPPORT', () => {
      expect(hasPermission('SUPPORT', 'admin:users:write')).toBe(false)
    })

    it('denies admin:users:write to READ_ONLY', () => {
      expect(hasPermission('READ_ONLY', 'admin:users:write')).toBe(false)
    })

    it('denies admin:admins:write to ADMIN', () => {
      expect(hasPermission('ADMIN', 'admin:admins:write')).toBe(false)
    })

    it('denies admin:admins:write to SUPPORT', () => {
      expect(hasPermission('SUPPORT', 'admin:admins:write')).toBe(false)
    })
  })

  describe('hasAllPermissions', () => {
    it('returns true when role has all permissions', () => {
      expect(hasAllPermissions('SUPER_ADMIN', ['admin:access', 'admin:users:read'])).toBe(true)
    })

    it('returns false when role lacks one permission', () => {
      expect(hasAllPermissions('READ_ONLY', ['admin:access', 'admin:users:write'])).toBe(false)
    })
  })

  describe('hasAnyPermission', () => {
    it('returns true when role has at least one', () => {
      expect(hasAnyPermission('SUPPORT', ['admin:users:write', 'admin:users:read'])).toBe(true)
    })

    it('returns false when role has none', () => {
      expect(hasAnyPermission('SUPPORT', ['admin:admins:write'])).toBe(false)
    })
  })

  describe('getPermissionsForRole', () => {
    it('returns all permissions for SUPER_ADMIN', () => {
      const perms = getPermissionsForRole('SUPER_ADMIN')
      expect(perms).toContain('admin:access')
      expect(perms).toContain('admin:users:write')
      expect(perms).toContain('admin:admins:write')
    })

    it('returns limited permissions for READ_ONLY', () => {
      const perms = getPermissionsForRole('READ_ONLY')
      expect(perms).toContain('admin:access')
      expect(perms).toContain('admin:users:read')
      expect(perms).not.toContain('admin:users:write')
      expect(perms).not.toContain('admin:settings:write')
    })

    it('returns empty for USER role', () => {
      expect(getPermissionsForRole('USER')).toEqual([])
    })
  })

  describe('isAdminRole', () => {
    it('returns true for SUPER_ADMIN', () => expect(isAdminRole('SUPER_ADMIN')).toBe(true))
    it('returns true for ADMIN', () => expect(isAdminRole('ADMIN')).toBe(true))
    it('returns true for SUPPORT', () => expect(isAdminRole('SUPPORT')).toBe(true))
    it('returns true for READ_ONLY', () => expect(isAdminRole('READ_ONLY')).toBe(true))
    it('returns false for USER', () => expect(isAdminRole('USER')).toBe(false))
  })
})
