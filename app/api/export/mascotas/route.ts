// @ts-nocheck — compatibilidad PETS: tipado estricto de este archivo pendiente.
import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/core/auth";
import { createExcelFile, excelDate } from "@/lib/excel-export";
import { fetchAll } from "@/lib/excel-import";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.redirect(new URL("/login", request.url));
  const admin = getSupabaseAdmin();

  const pets = await fetchAll((from, to) => {
    let query = admin.from("mascotas").select(`*, empresas(nombre), propietarios_mascotas(propietarios(nombre, telefono, whatsapp, numero_documento))`);
    if (profile.rol !== "super_admin") query = query.eq("empresa_id", profile.empresa_id);
    return query.order("nombre").range(from, to);
  });

  const includeCompany = profile.rol === "super_admin";
  const columns = [
    ...(includeCompany ? [{ header: "Empresa", key: "empresa", width: 24 }] : []),
    { header: "Nombre", key: "nombre", width: 24 },
    { header: "Número de carnet", key: "numero_carnet", width: 18 },
    { header: "Raza", key: "raza", width: 20 },
    { header: "Especie", key: "especie", width: 16 },
    { header: "Peso (kg)", key: "peso_kg", width: 12, numFmt: "0.00" },
    { header: "Fecha de nacimiento", key: "fecha_nacimiento", width: 20, numFmt: "dd/mm/yyyy" },
    { header: "Sexo", key: "sexo", width: 12 },
    { header: "Temperamento", key: "temperamento", width: 20 },
    { header: "Estado reproductivo", key: "estado_reproductivo", width: 22 },
    { header: "Número de partos", key: "numero_partos", width: 18, numFmt: "0" },
    { header: "Color", key: "color", width: 16 },
    { header: "Fecha de fallecimiento", key: "fecha_fallecimiento", width: 22, numFmt: "dd/mm/yyyy" },
    { header: "Motivo de fallecimiento", key: "motivo_fallecimiento", width: 28 },
    { header: "Comentarios del fallecimiento", key: "comentarios_fallecimiento", width: 34 },
    { header: "Estado", key: "estado", width: 14 },
    { header: "SEDE", key: "fuente", width: 24 },
    { header: "Propietarios", key: "propietarios", width: 34 },
    { header: "Teléfonos", key: "telefonos", width: 24 }
  ];

  const rows = pets.map((pet) => {
    const owners = (pet.propietarios_mascotas || []).map((relation) => relation.propietarios).filter(Boolean);
    return {
      ...(includeCompany ? { empresa: pet.empresas?.nombre || "" } : {}),
      nombre: pet.nombre,
      numero_carnet: pet.numero_carnet || "",
      raza: pet.raza || "",
      especie: pet.especie || "",
      peso_kg: pet.peso_kg === null ? null : Number(pet.peso_kg),
      fecha_nacimiento: excelDate(pet.fecha_nacimiento),
      sexo: pet.sexo || "",
      temperamento: pet.temperamento || "",
      estado_reproductivo: pet.estado_reproductivo || "",
      numero_partos: pet.numero_partos,
      color: pet.color || "",
      fecha_fallecimiento: excelDate(pet.fecha_fallecimiento),
      motivo_fallecimiento: pet.motivo_fallecimiento || "",
      comentarios_fallecimiento: pet.comentarios_fallecimiento || "",
      estado: pet.estado || "",
      fuente: pet.fuente || "",
      propietarios: owners.map((owner) => owner.nombre).join(", "),
      telefonos: owners.map((owner) => owner.whatsapp || owner.telefono).filter(Boolean).join(", ")
    };
  });

  const buffer = await createExcelFile({ sheetName: "Mascotas", columns, rows });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="mascotas-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Cache-Control": "no-store"
    }
  });
}
