/** Roles canónicos de Core SaaS (diferentes a los cargos por vertical). */
export const CORE_ROLES = {
  SUPER_ADMIN: "super_admin",
  SUPER_USER: "super_user",
  ADMIN: "admin",
  USER: "user"
} as const;
export type CoreRole = (typeof CORE_ROLES)[keyof typeof CORE_ROLES];
export type LegacyPetsRole = "empresa_admin" | "veterinario";

export function normalizeCoreRole(input: string | null | undefined): CoreRole | null {
  switch (input) {
    case "super_admin": return CORE_ROLES.SUPER_ADMIN;
    case "super_user": return CORE_ROLES.SUPER_USER;
    case "admin":
    case "empresa_admin": return CORE_ROLES.ADMIN;
    case "user":
    case "veterinario": return CORE_ROLES.USER;
    default: return null;
  }
}

export function canCreateRole(actor: CoreRole, target: CoreRole, sameCompany: boolean): boolean {
  if (actor === CORE_ROLES.SUPER_ADMIN) return true;
  if (actor === CORE_ROLES.ADMIN && sameCompany) {
    return target === CORE_ROLES.ADMIN || target === CORE_ROLES.USER;
  }
  return false;
}

/** Los super-users no reciben privilegios por nombre de rol: grants explícitos. */
export function isGlobalOwner(role: CoreRole | null): boolean {
  return role === CORE_ROLES.SUPER_ADMIN;
}

export interface MembershipAccess {
  userId: string;
  companyId: string;
  role: "admin" | "user";
  active: boolean;
  companyActive: boolean;
  activeProducts: readonly string[];
  grantedPermissions: readonly string[];
}

export function authorizeMembership(
  membership: MembershipAccess | null | undefined,
  subjectId: string,
  companyId: string,
  productCode: string,
  permissionCode: string
): boolean {
  if (!membership || !membership.active || !membership.companyActive) return false;
  if (membership.userId !== subjectId || membership.companyId !== companyId) return false;
  if (!productCode || !permissionCode) return false;
  if (!membership.activeProducts.includes(productCode)) return false;
  return membership.grantedPermissions.includes(permissionCode);
}

export function canDelegatePermission(actorPermissions: readonly string[], requested: readonly string[]): boolean {
  return requested.every(permission => actorPermissions.includes(permission));
}

export function canStartSupportSession(actorRole: CoreRole | null, targetUserId: string, actorUserId: string, reason: string): boolean {
  return actorRole === CORE_ROLES.SUPER_ADMIN &&
    Boolean(targetUserId && targetUserId !== actorUserId && reason.trim().length >= 10);
}
