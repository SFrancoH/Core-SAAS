import "server-only";

import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/core/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { validPetTenantInput, type PetTenantPermission } from "./tenant-policy";

export type PetTenantContext = {
  actorId: string;
  companyId: string;
  companyName: string;
  permission: PetTenantPermission;
};

/** Fase 1: solo las páginas nuevas, de lectura, usan este contexto.
 * Se activa después de instalar y probar 010/011/012, nunca por la UI.
 *
 * Actor Auth real => RPC service_role autorizada => DB filtra/revalida tenant.
 * Prohibido recibir actor_id desde body, headers, metadata o params.
 */
export async function requirePetTenant(
  companyId: string,
  permission: PetTenantPermission = "pets.pet.read"
): Promise<PetTenantContext> {
  if (process.env.CORE_PETS_MULTI_TENANT_READ_ENABLED !== "true") notFound();
  if (!validPetTenantInput(companyId,permission)) notFound();
  const actor = await getCurrentProfile();
  if (!actor) redirect("/login");
  const admin = getSupabaseAdmin();
  const { data: allowed, error: rpcError } = await admin.rpc("core_pets_tenant_access", {
    p_actor_id: actor.id, p_empresa_id: companyId, p_permission: permission
  });
  if (rpcError || allowed !== true) notFound(); // deny-by-default
  const { data: company, error: companyError } = await admin
    .from("empresas").select("id,nombre,activa").eq("id",companyId).maybeSingle();
  if (companyError || !company?.activa || company.id !== companyId) notFound();
  return { actorId: actor.id, companyId, companyName: company.nombre, permission };
}
