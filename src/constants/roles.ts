export const ROLES = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
} as const

export type RoleType = (typeof ROLES)[keyof typeof ROLES]
