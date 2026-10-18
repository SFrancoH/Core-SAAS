import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeCoreRole } from "@/lib/core/roles";

export interface CoreProfile {
  id: string;
  empresa_id: string | null;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
}

/** Perfil que conserva el contrato de PETS; origen de sesión: Supabase Auth. */
export async function getCurrentProfile(): Promise<CoreProfile | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("usuarios")
    .select("id, empresa_id, nombre, email, rol, activo")
    .eq("id", user.id)
    .maybeSingle();

  // Un usuario PETS desactivado no puede recurrir a la cuenta Core.
  if (error) return null;
  if (profile) return profile.activo ? profile as CoreProfile : null;

  // Nueva identidad global desde 011. Si la RPC no existe, no habilitar acceso.
  const { data, error: coreError } = await getSupabaseAdmin()
    .rpc("core_identity", { p_actor_id: user.id });
  if (coreError || !data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  if (record.id !== user.id || record.activo !== true ||
      typeof record.nombre !== "string" || typeof record.email !== "string" ||
      typeof record.rol !== "string" || !normalizeCoreRole(record.rol)) return null;
  return {
    id: user.id, empresa_id: null, nombre: record.nombre,
    email: record.email, rol: record.rol, activo: true
  };
}

/** Redirecciones históricas PETS conservadas. */
export async function requireProfile(roles: readonly string[] = []): Promise<CoreProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (roles.length > 0 && !roles.includes(profile.rol)) redirect("/panel");
  return profile;
}
