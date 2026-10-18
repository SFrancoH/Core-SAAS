"use server";

// @ts-nocheck — pendiente tipar lógica heredada PETS.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireProfile } from "@/lib/core/auth";
import {
  dateValue,
  fetchAll,
  insertInChunks,
  numberValue,
  pick,
  readFirstWorksheet,
  textValue,
  weightKgValue
} from "@/lib/excel-import";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function importPets(formData) {
  const actor = await requireProfile(["super_admin"]);
  const companyId = String(formData.get("empresa_id") || "");
  const file = formData.get("archivo");
  if (!uuidPattern.test(companyId)) redirect("/mascotas?error=empresa");

  try {
    const sourceRows = await readFirstWorksheet(file);
    const admin = getSupabaseAdmin();
    const { data: company } = await admin.from("empresas").select("id").eq("id", companyId).eq("activa", true).maybeSingle();
    if (!company) redirect("/mascotas?error=empresa");

    const existing = await fetchAll((from, to) =>
      admin.from("mascotas").select("numero_carnet").eq("empresa_id", companyId).range(from, to)
    );
    const existingCarnets = new Set(existing.map((row) => String(row.numero_carnet || "").trim().toLowerCase()).filter(Boolean));
    const fileCarnets = new Set();
    const rows = [];
    let duplicateCarnets = 0;
    let skippedExisting = 0;
    let skippedWithoutName = 0;

    for (const source of sourceRows) {
      const nombre = textValue(pick(source, ["nombre", "nombre mascota"]));
      if (!nombre) {
        skippedWithoutName += 1;
        continue;
      }
      const numeroCarnet = textValue(pick(source, [
        "numero_carnet",
        "numero carnet",
        "numero mero de carnet",
        "no historia",
        "no. historia"
      ]));
      const carnetKey = numeroCarnet?.toLowerCase();
      if (carnetKey && fileCarnets.has(carnetKey)) {
        duplicateCarnets += 1;
        continue;
      }
      if (carnetKey) fileCarnets.add(carnetKey);
      if (carnetKey && existingCarnets.has(carnetKey)) {
        skippedExisting += 1;
        continue;
      }
      const isHopspetExport = Object.hasOwn(source, "fechadenacimiento");
      const slashOrder = isHopspetExport ? "MDY" : "DMY";

      rows.push({
        empresa_id: companyId,
        nombre,
        raza: textValue(pick(source, ["raza"])),
        especie: textValue(pick(source, ["especie", "tipo"])),
        peso_kg: weightKgValue(pick(source, ["peso", "peso_kg", "peso kg"])),
        fecha_nacimiento: dateValue(pick(source, ["fecha_nacimiento", "fecha de nacimiento"]), slashOrder),
        sexo: textValue(pick(source, ["sexo"])),
        temperamento: textValue(pick(source, ["temperamento"])),
        numero_carnet: numeroCarnet,
        fuente: textValue(pick(source, ["fuente", "sede"])),
        estado_reproductivo: textValue(pick(source, ["estado_reproductivo", "estado reproductivo"])),
        tamano: textValue(pick(source, ["tamano", "tamaño"])),
        numero_partos: numberValue(pick(source, ["numero_partos", "numero de partos", "numerodepartos"]), true),
        color: textValue(pick(source, ["color"])),
        fecha_fallecimiento: dateValue(pick(source, ["fecha_fallecimiento", "fecha de fallecimiento"]), slashOrder),
        motivo_fallecimiento: textValue(pick(source, ["motivo_fallecimiento", "motivo de fallecimiento"])),
        comentarios_fallecimiento: textValue(pick(source, ["comentarios_fallecimiento", "comentarios del fallecimiento"])),
        estado: textValue(pick(source, ["estado"])) || "Activo",
        creada_por: actor.id,
        actualizada_por: actor.id
      });
    }

    if (duplicateCarnets) {
      redirect(`/mascotas?error=carnets_repetidos&conflictos=${duplicateCarnets}`);
    }
    if (!rows.length && !skippedExisting) redirect("/mascotas?error=sin_filas");
    if (rows.length) await insertInChunks("mascotas", rows, admin, 500);
    revalidatePath("/mascotas");
    const omitted = skippedExisting + skippedWithoutName;
    redirect(`/mascotas?ok=importado&importados=${rows.length}&omitidos=${omitted}`);
  } catch (error) {
    if (error?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    redirect("/mascotas?error=archivo");
  }
}
