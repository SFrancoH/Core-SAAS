"use server";

// @ts-nocheck — pendiente tipar lógica heredada PETS.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOperationalProfile } from "@/lib/verticals/pets/operational";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sedes } from "@/lib/verticals/pets/pet-catalogs";

const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function read(formData, key, max = 240) {
  return String(formData.get(key) || "").trim().slice(0, max);
}

function fail(petId, code) {
  redirect(`/mascotas/${petId}/propietarios/nuevo?error=${encodeURIComponent(code)}`);
}

export async function addOwnerToPet(petId, formData) {
  const profile = await requireOperationalProfile();
  if (!validUuid.test(petId || "")) redirect("/mascotas");

  const owner = {
    nombre: read(formData, "nombre", 80),
    apellido: read(formData, "apellido", 80),
    whatsapp: read(formData, "whatsapp", 40),
    telefono: read(formData, "telefono", 40),
    correo_electronico: read(formData, "correo_electronico", 160).toLowerCase(),
    ciudad: read(formData, "ciudad", 100),
    direccion: read(formData, "direccion", 220),
    tipo_documento: read(formData, "tipo_documento", 80),
    numero_documento: read(formData, "numero_documento", 80),
    notificacion_email: read(formData, "notificacion_email", 10),
    notificacion_whatsapp: read(formData, "notificacion_whatsapp", 10),
    fuente: read(formData, "fuente", 40)
  };
  if (owner.nombre.length < 2 || !owner.correo_electronico.includes("@")
    || owner.whatsapp.replace(/\D/g, "").length < 7
    || !owner.numero_documento || !owner.tipo_documento
    || !["Si", "No"].includes(owner.notificacion_email)
    || !["Si", "No"].includes(owner.notificacion_whatsapp)
    || !sedes.includes(owner.fuente)) fail(petId, "datos");

  const admin = getSupabaseAdmin();
  let query = admin.from("mascotas").select("id, empresa_id").eq("id", petId);
  if (profile.rol !== "super_admin") query = query.eq("empresa_id", profile.empresa_id);
  const { data: pet, error: petError } = await query.maybeSingle();
  if (petError || !pet) redirect("/mascotas");

  const { data, error } = await admin.rpc("asociar_propietario_mascota_pets", {
    p_mascota_id: pet.id,
    p_actor_id: profile.id,
    p_propietario: owner
  });
  if (error || !data?.success) {
    console.error("Error al asociar propietario a mascota", {
      code: error?.code
    });
    if (error?.code === "P0001" || error?.code === "23505") fail(petId, "conflicto");
    if (error?.code === "PGRST202" || error?.code === "42883") fail(petId, "migracion");
    fail(petId, "guardar");
  }

  revalidatePath(`/mascotas/${pet.id}`);
  revalidatePath(`/propietarios/${data.propietario_id}`);
  revalidatePath("/propietarios");
  redirect(`/mascotas/${pet.id}?propietario=${encodeURIComponent(data.resultado || "asociado")}`);
}
