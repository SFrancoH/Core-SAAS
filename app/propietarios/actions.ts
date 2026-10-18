"use server";

// @ts-nocheck — pendiente tipar lógica heredada PETS.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireProfile } from "@/lib/core/auth";
import {
  booleanValue,
  fetchAll,
  insertInChunks,
  pick,
  readFirstWorksheet,
  textValue,
  upsertInChunks
} from "@/lib/excel-import";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeIdentity(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function phoneIdentity(value) {
  return String(value || "").replace(/\D/g, "");
}

function ownerIdentity(owner) {
  const document = normalizeIdentity(owner.numero_documento);
  if (document) return `documento:${document}`;
  const email = normalizeIdentity(owner.email);
  if (email) return `email:${email}`;
  const name = normalizeIdentity(owner.nombre);
  const contact = phoneIdentity(owner.whatsapp) || phoneIdentity(owner.telefono);
  if (contact) return `contacto:${name}:${contact}`;
  return `nombre:${name}:${normalizeIdentity(owner.ciudad)}:${normalizeIdentity(owner.direccion)}`;
}

function mergeMissing(target, source) {
  for (const field of ["ciudad", "direccion", "telefono", "whatsapp", "email", "tipo_documento", "numero_documento", "fuente"]) {
    if (!target[field] && source[field]) target[field] = source[field];
  }
  target.notificaciones_whatsapp ||= source.notificaciones_whatsapp;
  target.tags = [...new Set([...(target.tags || []), ...(source.tags || [])])];
}

export async function importOwners(formData) {
  const actor = await requireProfile(["super_admin"]);
  const companyId = String(formData.get("empresa_id") || "");
  const file = formData.get("archivo");
  if (!uuidPattern.test(companyId)) redirect("/propietarios?error=empresa");

  try {
    const sourceRows = await readFirstWorksheet(file);
    const admin = getSupabaseAdmin();
    const { data: company } = await admin.from("empresas").select("id").eq("id", companyId).eq("activa", true).maybeSingle();
    if (!company) redirect("/propietarios?error=empresa");

    const existing = await fetchAll((from, to) =>
      admin
        .from("propietarios")
        .select("id, nombre, ciudad, direccion, telefono, whatsapp, email, numero_documento")
        .eq("empresa_id", companyId)
        .range(from, to)
    );
    const existingByIdentity = new Map(existing.map((owner) => [ownerIdentity(owner), owner]));
    const groups = new Map();

    for (const source of sourceRows) {
      const nombre = textValue(pick(source, ["nombre propietario", "nombre del propietario", "nombre"]));
      if (!nombre) continue;
      const document = textValue(pick(source, ["numero_documento", "numero de documento"]));
      const email = textValue(pick(source, ["email", "correo", "correo electronico"]));
      const carnets = String(pick(source, [
        "numeros_carnet",
        "numeros de carnet",
        "numero carnet",
        "numero mero de carnet",
        "carnets"
      ]) || "")
        .split(/[,;|]/).map((value) => value.trim()).filter(Boolean);
      const owner = {
        empresa_id: companyId,
        nombre,
        ciudad: textValue(pick(source, ["ciudad"])),
        direccion: textValue(pick(source, ["direccion"])),
        telefono: textValue(pick(source, ["telefono", "celular"])),
        whatsapp: textValue(pick(source, ["whatsapp"])),
        email,
        tipo_documento: textValue(pick(source, ["tipo_documento", "tipo de documento"])),
        numero_documento: document,
        fuente: textValue(pick(source, ["fuente", "sede"])),
        estado: textValue(pick(source, ["estado"])) || "Activo",
        notificaciones_whatsapp: booleanValue(pick(source, ["notificaciones_whatsapp", "notificacion de whatsapp"])),
        tags: String(pick(source, ["tags", "tag"]) || "").split(/[,;|]/).map((value) => value.trim()).filter(Boolean),
        creado_por: actor.id,
        actualizado_por: actor.id
      };
      const identity = ownerIdentity(owner);
      const group = groups.get(identity);
      if (group) {
        mergeMissing(group.owner, owner);
        carnets.forEach((carnet) => group.carnets.add(carnet));
      } else {
        groups.set(identity, { identity, owner, carnets: new Set(carnets) });
      }
    }

    if (!groups.size) redirect("/propietarios?error=sin_filas");
    const newGroups = [...groups.values()].filter((group) => !existingByIdentity.has(group.identity));
    const rows = newGroups.map((group) => group.owner);
    if (rows.length) await insertInChunks("propietarios", rows, admin, 500);

    const [owners, pets] = await Promise.all([
      fetchAll((from, to) =>
        admin
          .from("propietarios")
          .select("id, nombre, ciudad, direccion, telefono, whatsapp, email, numero_documento")
          .eq("empresa_id", companyId)
          .range(from, to)
      ),
      fetchAll((from, to) => admin.from("mascotas").select("id, numero_carnet").eq("empresa_id", companyId).range(from, to))
    ]);
    const ownersByIdentity = new Map(owners.map((owner) => [ownerIdentity(owner), owner.id]));
    const petsByCarnet = new Map(pets.map((pet) => [String(pet.numero_carnet || "").toLowerCase(), pet.id]).filter(([key]) => key));
    const links = [];
    const usedLinks = new Set();
    let unmatchedAssociations = 0;
    for (const group of groups.values()) {
      const ownerId = ownersByIdentity.get(group.identity);
      if (!ownerId) continue;
      group.carnets.forEach((carnet) => {
        const petId = petsByCarnet.get(carnet.toLowerCase());
        if (!petId) {
          unmatchedAssociations += 1;
          return;
        }
        const linkKey = `${ownerId}:${petId}`;
        if (usedLinks.has(linkKey)) return;
        usedLinks.add(linkKey);
        links.push({ empresa_id: companyId, propietario_id: ownerId, mascota_id: petId, creado_por: actor.id });
      });
    }
    if (links.length) {
      await upsertInChunks(
        "propietarios_mascotas",
        links,
        admin,
        { onConflict: "propietario_id,mascota_id", ignoreDuplicates: true },
        500
      );
    }

    revalidatePath("/propietarios");
    revalidatePath("/mascotas");
    redirect(
      `/propietarios?ok=importado&importados=${rows.length}&agrupados=${groups.size}&asociados=${links.length}&sin_mascota=${unmatchedAssociations}`
    );
  } catch (error) {
    if (error?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    redirect("/propietarios?error=archivo");
  }
}
