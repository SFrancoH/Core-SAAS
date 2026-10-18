import "server-only";
import { getCurrentProfile } from "@/lib/core/auth";
import { UUID_RE, CoreAccessError } from "@/lib/core/access";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface CoreAuthorizationOptions {
  companyId?: string;
  entitlement?: string | null;
}

/**
 * Autorización para nuevos casos de uso.
 * La identidad viene de la sesión real, nunca del cuerpo HTTP.
 * La RPC valida empresa, permisos y licencia; ante ausencia o error DENIEGA.
 * Las rutas PETS existentes conservan temporalmente su autorización anterior.
 */
export async function requireCorePermission(
  permission: string,
  { companyId, entitlement = null }: CoreAuthorizationOptions = {}
): Promise<{ actor: NonNullable<Awaited<ReturnType<typeof getCurrentProfile>>>; companyId: string }> {
  const actor = await getCurrentProfile();
  if (!actor) throw new CoreAccessError("UNAUTHENTICATED");
  const requestedCompanyId = String(companyId || actor.empresa_id || "");
  if (!UUID_RE.test(requestedCompanyId)) throw new CoreAccessError("INVALID_COMPANY");
  if (!permission || typeof permission !== "string") {
    throw new CoreAccessError("INVALID_PERMISSION");
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("core_autorizar_operacion", {
    p_actor_id: actor.id,
    p_empresa_id: requestedCompanyId,
    p_permiso: permission,
    p_licencia: entitlement
  });
  if (error || data !== true) throw new CoreAccessError("FORBIDDEN");
  return { actor, companyId: requestedCompanyId };
}
