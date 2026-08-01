// ProxyAI — Admin RBAC Permissions (Milestone 1)
// Centralized permission system. All route/component guards use these helpers.
// Never hardcode role strings in components or routes.

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'READ_ONLY'

export type AdminPermission =
  | 'admin:access'         // Can access admin dashboard
  | 'admin:users:read'     // View users
  | 'admin:users:write'    // Create/edit/delete users
  | 'admin:wallet:read'    // View wallets
  | 'admin:wallet:write'   // Adjust wallet balances
  | 'admin:billing:read'   // View billing/pricing
  | 'admin:billing:write'  // Modify pricing
  | 'admin:providers:read' // View providers
  | 'admin:providers:write'// Configure providers
  | 'admin:pricing:read'   // View pricing config
  | 'admin:pricing:write'  // Modify pricing
  | 'admin:audit:read'     // View audit logs
  | 'admin:analytics:read' // View analytics
  | 'admin:settings:read'  // View admin settings
  | 'admin:settings:write' // Modify admin settings
  | 'admin:admins:read'    // View admin list
  | 'admin:admins:write'   // Create/manage admins

/** Role-to-permission mapping. Single source of truth. */
const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  SUPER_ADMIN: [
    'admin:access',
    'admin:users:read',
    'admin:users:write',
    'admin:wallet:read',
    'admin:wallet:write',
    'admin:billing:read',
    'admin:billing:write',
    'admin:providers:read',
    'admin:providers:write',
    'admin:pricing:read',
    'admin:pricing:write',
    'admin:audit:read',
    'admin:analytics:read',
    'admin:settings:read',
    'admin:settings:write',
    'admin:admins:read',
    'admin:admins:write',
  ],
  ADMIN: [
    'admin:access',
    'admin:users:read',
    'admin:users:write',
    'admin:wallet:read',
    'admin:wallet:write',
    'admin:billing:read',
    'admin:billing:write',
    'admin:providers:read',
    'admin:pricing:read',
    'admin:audit:read',
    'admin:analytics:read',
    'admin:settings:read',
  ],
  SUPPORT: [
    'admin:access',
    'admin:users:read',
    'admin:wallet:read',
    'admin:billing:read',
    'admin:audit:read',
  ],
  READ_ONLY: [
    'admin:access',
    'admin:users:read',
    'admin:wallet:read',
    'admin:billing:read',
    'admin:providers:read',
    'admin:pricing:read',
    'admin:audit:read',
    'admin:analytics:read',
  ],
}

/** Map a Prisma Role string to AdminRole. */
function normalizeRole(role: string): AdminRole | null {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'SUPPORT' || role === 'READ_ONLY') {
    return role
  }
  return null
}

/**
 * Check if a user has a specific permission based on their role.
 */
export function hasPermission(role: string, permission: AdminPermission): boolean {
  const normalized = normalizeRole(role)
  if (!normalized) return false
  return ROLE_PERMISSIONS[normalized].includes(permission)
}

/**
 * Check if a user has ALL of the specified permissions.
 */
export function hasAllPermissions(role: string, permissions: AdminPermission[]): boolean {
  return permissions.every((perm) => hasPermission(role, perm))
}

/**
 * Check if a user has ANY of the specified permissions.
 */
export function hasAnyPermission(role: string, permissions: AdminPermission[]): boolean {
  return permissions.some((perm) => hasPermission(role, perm))
}

/**
 * Get all permissions for a given role.
 */
export function getPermissionsForRole(role: string): AdminPermission[] {
  const normalized = normalizeRole(role)
  if (!normalized) return []
  return [...ROLE_PERMISSIONS[normalized]]
}

/**
 * Check if a role is an admin role (has admin:access).
 */
export function isAdminRole(role: string): boolean {
  return hasPermission(role, 'admin:access')
}
