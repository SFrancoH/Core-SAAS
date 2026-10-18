import "server-only";

import { getCurrentProfile } from "@/lib/core/auth";
import { UUID_RE, CoreAccessError } from "@/lib/core/access.mjs";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Puerta de autorización de cualquier nuevo caso de uso Core o vertical.
 * 1. La identidad del actor procede de Supabase Auth (nunca del body).
 * 2. El UUID pedido es solo el contexto, NO concede acceso.
 * 3. La RPC valida empresa activa, membresía/rol, permiso y licencia.
 * 4. Un error o ausencia de RPC significa acceso DENEGADO.
 *
 * PETS mantiene sus rutas actuales hasta implantar SQL 010 y probarlas.
 * @param {string} permission Ej. pulse.project.create
 * @param {{companyId?:string, entitlement?:string|null}} options
 */
export async function requireCorePermission(permission, { companyId, entitlement = null } = {}) {
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
