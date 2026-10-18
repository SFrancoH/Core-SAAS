import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentProfile() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("usuarios")
    .select("id, empresa_id, nombre, email, rol, activo")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.activo) {
    return null;
  }

  return profile;
}

export async function requireProfile(roles = []) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (roles.length > 0 && !roles.includes(profile.rol)) {
    redirect("/panel");
  }

  return profile;
}
