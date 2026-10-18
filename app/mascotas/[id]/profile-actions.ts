// @ts-nocheck — pendiente tipar lógica heredada PETS.
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOperationalProfile } from "@/lib/verticals/pets/operational";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sedes, especies, razas, temperamentos, estadosReproductivos, tamanos, estadosMascota } from "@/lib/verticals/pets/pet-catalogs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function field(data, key, max = 500) {
  return String(data.get(key) || "").trim().slice(0, max);
}
function nullableNumber(data, key, integer = false) {
  const value = field(data, key, 30);
  if (!value) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || (integer && !Number.isInteger(number))) throw new Error("invalid_number");
  return number;
}
function allowed(value, values, previous) {
  return !value || values.includes(value) || value === previous;
}

export async function updatePetProfile(petId, formData) {
  const actor = await requireOperationalProfile();
  if (!uuidPattern.test(petId)) redirect("/mascotas");
  const admin = getSupabaseAdmin();
  let query = admin.from("mascotas").select("*").eq("id", petId);
  if (actor.rol !== "super_admin") query = query.eq("empresa_id", actor.empresa_id);
  const { data: current, error: readError } = await query.maybeSingle();
  if (readError || !current) redirect("/mascotas");
  const fail = () => redirect(`/mascotas/${petId}?editar=1&error_perfil=1`);
  try {
    const nombre = field(formData, "nombre", 120);
    const especie = field(formData, "especie", 80);
    const raza = field(formData, "raza", 120);
    const temperamento = field(formData, "temperamento", 120);
    const estadoReproductivo = field(formData, "estado_reproductivo", 100);
    const tamano = field(formData, "tamano", 30);
    const fuente = field(formData, "fuente", 100);
    const estado = field(formData, "estado", 20);
    const nacimiento = field(formData, "fecha_nacimiento", 10) || null;
    const fallecimiento = field(formData, "fecha_fallecimiento", 10) || null;
    const carnet = field(formData, "numero_carnet", 100);
    if (!nombre || !estado || !estadosMascota.includes(estado) || 
        !allowed(especie, especies, current.especie) || !allowed(raza, razas, current.raza) ||
        !allowed(temperamento, temperamentos, current.temperamento) ||
        !allowed(estadoReproductivo, estadosReproductivos, current.estado_reproductivo) ||
        !allowed(tamano, tamanos, current.tamano) ||
        !allowed(fuente, sedes, current.fuente) ||
        (fallecimiento && nacimiento && fallecimiento < nacimiento)) fail();
    const update = {
      nombre, especie: especie || null, raza: raza || null,
      sexo: field(formData, "sexo", 40) || null,
      fecha_nacimiento: nacimiento,
      color: field(formData, "color", 80) || null,
      peso_kg: nullableNumber(formData, "peso_kg"),
      temperamento: temperamento || null,
      numero_carnet: carnet || null,
      estado_reproductivo: estadoReproductivo || null,
      numero_partos: nullableNumber(formData, "numero_partos", true),
      tamano: tamano || null,
      fuente: fuente || null,
      estado,
      fecha_fallecimiento: fallecimiento,
      motivo_fallecimiento: field(formData, "motivo_fallecimiento", 5000) || null,
      comentarios_fallecimiento: field(formData, "comentarios_fallecimiento", 5000) || null,
      actualizada_por: actor.id
    };
    const { error } = await admin.from("mascotas").update(update)
      .eq("id", petId).eq("empresa_id", current.empresa_id);
    if (error) throw error;
    revalidatePath(`/mascotas/${petId}`);
    revalidatePath("/mascotas");
  } catch (error) {
    if (error?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    console.error("No se actualizó la ficha de mascota", { code: error?.code, message: error?.message });
    fail();
  }
  redirect(`/mascotas/${petId}?perfil_actualizado=1`);
}
