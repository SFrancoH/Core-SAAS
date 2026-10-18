import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  if (error || !profile?.activo) return null;
  return profile as CoreProfile;
}

/** Redirecciones históricas PETS conservadas. */
export async function requireProfile(roles: readonly string[] = []): Promise<CoreProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (roles.length > 0 && !roles.includes(profile.rol)) redirect("/panel");
  return profile;
}
