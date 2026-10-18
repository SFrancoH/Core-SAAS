"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireProfile } from "@/lib/core/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function createVeterinarian(formData) {
  const actor = await requireProfile(["empresa_admin"]);
  const nombre = String(formData.get("nombre") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (nombre.length < 2 || !email.includes("@") || password.length < 8) {
    redirect("/empresa?error=datos_usuario");
  }

  const admin = getSupabaseAdmin();
  const { data: authResult, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, empresa_id: actor.empresa_id, rol: "veterinario" }
  });

  if (authError || !authResult.user) redirect("/empresa?error=crear_auth");

  const { error: profileError } = await admin.from("usuarios").insert({
    id: authResult.user.id,
    empresa_id: actor.empresa_id,
    nombre,
    email,
    rol: "veterinario",
    activo: true,
    creado_por: actor.id
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(authResult.user.id);
    redirect("/empresa?error=crear_perfil");
  }

  revalidatePath("/empresa");
  redirect("/empresa?ok=usuario_creado");
}

async function getManagedVeterinarian(actor, userId) {
  if (!uuidPattern.test(userId)) return null;
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("usuarios")
    .select("id, empresa_id, rol")
    .eq("id", userId)
    .eq("empresa_id", actor.empresa_id)
    .eq("rol", "veterinario")
    .maybeSingle();
  return data;
}

export async function resetVeterinarianPassword(formData) {
  const actor = await requireProfile(["empresa_admin"]);
  const userId = String(formData.get("usuario_id") || "");
  const password = String(formData.get("password") || "");

  if (password.length < 8) redirect("/empresa?error=password");
  const target = await getManagedVeterinarian(actor, userId);
  if (!target) redirect("/empresa?error=permiso");

  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) redirect("/empresa?error=password");

  redirect("/empresa?ok=password");
}

export async function setVeterinarianStatus(formData) {
  const actor = await requireProfile(["empresa_admin"]);
  const userId = String(formData.get("usuario_id") || "");
  const activo = String(formData.get("activo")) === "true";
  const target = await getManagedVeterinarian(actor, userId);
  if (!target) redirect("/empresa?error=permiso");

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("usuarios").update({ activo }).eq("id", userId);
  if (error) redirect("/empresa?error=estado");

  revalidatePath("/empresa");
  redirect("/empresa?ok=estado");
}
