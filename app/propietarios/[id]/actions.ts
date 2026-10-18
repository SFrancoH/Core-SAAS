"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOperationalProfile } from "@/lib/verticals/pets/operational";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sedes } from "@/lib/verticals/pets/pet-catalogs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const value = (data: FormData, key: string, max = 500): string => String(data.get(key) || "").trim().slice(0, max);

export async function updateOwnerProfile(ownerId: string, formData: FormData) {
  const actor = await requireOperationalProfile();
  if (!uuidPattern.test(ownerId)) redirect("/propietarios");
  const admin = getSupabaseAdmin();
  let query = admin.from("propietarios").select("id, empresa_id, fuente").eq("id", ownerId);
  if (actor.rol !== "super_admin") query = query.eq("empresa_id", actor.empresa_id);
  const { data: owner } = await query.maybeSingle();
  if (!owner) redirect("/propietarios");
  const fail = () => redirect(`/propietarios/${ownerId}?editar=1&error_perfil=1`);
  const nombre = value(formData, "nombre", 120);
  const fuente = value(formData, "fuente", 100);
  const estado = value(formData, "estado", 20);
  if (nombre.length < 2 || !["Activo", "Inactivo"].includes(estado) ||
      (fuente && !sedes.includes(fuente) && fuente !== owner.fuente)) fail();
  const update = {
    nombre,
    ciudad: value(formData, "ciudad", 100) || null,
    direccion: value(formData, "direccion", 220) || null,
    telefono: value(formData, "telefono", 40) || null,
    whatsapp: value(formData, "whatsapp", 40) || null,
    email: value(formData, "email", 160).toLowerCase() || null,
    tipo_documento: value(formData, "tipo_documento", 80) || null,
    numero_documento: value(formData, "numero_documento", 80) || null,
    fuente: fuente || null,
    estado,
    notificaciones_whatsapp: formData.get("notificaciones_whatsapp") === "si",
    tags: value(formData, "tags", 2000).split(",").map((s) => s.trim()).filter(Boolean),
    actualizado_por: actor.id
  };
  try {
    const { error } = await admin.from("propietarios").update(update)
      .eq("empresa_id", owner.empresa_id).eq("id", ownerId);
    if (error) throw error;
    revalidatePath(`/propietarios/${ownerId}`);
    revalidatePath("/propietarios");
  } catch (error: unknown) {
    const info = error && typeof error === "object" ? error as { code?: string; message?: string } : {};
    console.error("No se actualizó el propietario", { code: info.code, message: info.message });
    fail();
  }
  redirect(`/propietarios/${ownerId}?perfil_actualizado=1`);
}
