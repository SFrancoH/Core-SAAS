// @ts-nocheck — pendiente tipar lógica heredada PETS.
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireProfile } from "@/lib/core/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function companyPath(companyId, query = "") {
  return `/super-admin/empresas/${companyId}${query}`;
}

export async function createCompanyAdmin(formData) {
  const actor = await requireProfile(["super_admin"]);
  const companyId = String(formData.get("empresa_id") || "");
  const nombre = String(formData.get("nombre") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!uuidPattern.test(companyId)) redirect("/super-admin");
  if (nombre.length < 2 || !email.includes("@") || password.length < 8) {
    redirect(companyPath(companyId, "?error=datos_usuario"));
  }

  const admin = getSupabaseAdmin();
  const { data: company } = await admin
    .from("empresas")
    .select("id")
    .eq("id", companyId)
    .maybeSingle();

  if (!company) redirect("/super-admin");

  const { data: authResult, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, empresa_id: companyId, rol: "empresa_admin" }
  });

  if (authError || !authResult.user) {
    redirect(companyPath(companyId, "?error=crear_auth"));
  }

  const { error: profileError } = await admin.from("usuarios").insert({
    id: authResult.user.id,
    empresa_id: companyId,
    nombre,
    email,
    rol: "empresa_admin",
    activo: true,
    creado_por: actor.id
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(authResult.user.id);
    redirect(companyPath(companyId, "?error=crear_perfil"));
  }

  revalidatePath(companyPath(companyId));
  redirect(companyPath(companyId, "?ok=usuario_creado"));
}

export async function resetCompanyUserPassword(formData) {
  await requireProfile(["super_admin"]);
  const companyId = String(formData.get("empresa_id") || "");
  const userId = String(formData.get("usuario_id") || "");
  const password = String(formData.get("password") || "");

  if (!uuidPattern.test(companyId) || !uuidPattern.test(userId)) redirect("/super-admin");
  if (password.length < 8) {
    redirect(companyPath(companyId, "?error=password"));
  }

  const admin = getSupabaseAdmin();
  const { data: target } = await admin
    .from("usuarios")
    .select("id, rol")
    .eq("id", userId)
    .eq("empresa_id", companyId)
    .maybeSingle();

  if (!target || target.rol === "super_admin") redirect("/super-admin");

  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) redirect(companyPath(companyId, "?error=password"));

  redirect(companyPath(companyId, "?ok=password"));
}

export async function setCompanyUserStatus(formData) {
  await requireProfile(["super_admin"]);
  const companyId = String(formData.get("empresa_id") || "");
  const userId = String(formData.get("usuario_id") || "");
  const activo = String(formData.get("activo")) === "true";

  if (!uuidPattern.test(companyId) || !uuidPattern.test(userId)) redirect("/super-admin");

  const admin = getSupabaseAdmin();
  const { data: target } = await admin
    .from("usuarios")
    .select("id, rol")
    .eq("id", userId)
    .eq("empresa_id", companyId)
    .maybeSingle();

  if (!target || target.rol === "super_admin") redirect("/super-admin");

  const { error } = await admin.from("usuarios").update({ activo }).eq("id", userId);
  if (error) redirect(companyPath(companyId, "?error=estado"));

  revalidatePath(companyPath(companyId));
  redirect(companyPath(companyId, "?ok=estado"));
}

export async function saveContactIntegration(formData) {
  const actor = await requireProfile(["super_admin"]);
  const companyId = String(formData.get("empresa_id") || "");
  const formUrl = String(formData.get("formulario_url") || "").trim();
  const active = String(formData.get("activa")) === "on";

  if (!uuidPattern.test(companyId)) redirect("/super-admin");

  let parsedUrl;
  try {
    parsedUrl = new URL(formUrl);
  } catch {
    redirect(companyPath(companyId, "?error=integracion"));
  }
  if (parsedUrl.protocol !== "https:") redirect(companyPath(companyId, "?error=integracion"));

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("integraciones_contacto").upsert({
    empresa_id: companyId,
    formulario_url: parsedUrl.toString(),
    activa: active,
    creada_por: actor.id,
    actualizada_por: actor.id
  }, { onConflict: "empresa_id" });

  if (error) redirect(companyPath(companyId, "?error=integracion"));
  revalidatePath(companyPath(companyId));
  redirect(companyPath(companyId, "?ok=integracion"));
}
