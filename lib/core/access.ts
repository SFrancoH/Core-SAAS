/**
 * Validaciones puras de contexto empresarial.
 * No reemplazan permisos/licencias ni las políticas de PostgreSQL.
 */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CompanyScopeProfile = {
  activo: boolean;
  rol: string;
  empresa_id: string | null;
};

export class CoreAccessError extends Error {
  readonly code: string;
  constructor(code = "FORBIDDEN") {
    super(code);
    this.name = "CoreAccessError";
    this.code = code;
  }
}

export function requireCompanyScope(
  profile: CompanyScopeProfile | null | undefined,
  requestedCompanyId?: string | null
): string {
  if (!profile?.activo) throw new CoreAccessError("UNAUTHENTICATED");
  const companyId = String(requestedCompanyId || profile.empresa_id || "");
  if (!UUID_RE.test(companyId)) throw new CoreAccessError("INVALID_COMPANY");
  if (profile.rol !== "super_admin" && profile.empresa_id !== companyId) {
    throw new CoreAccessError("FORBIDDEN");
  }
  return companyId;
}

export function assertResourceCompany(
  companyId: string,
  resourceCompanyId: string | null
): true {
  if (!UUID_RE.test(String(companyId || "")) || resourceCompanyId !== companyId) {
    throw new CoreAccessError("RESOURCE_NOT_FOUND");
  }
  return true;
}
