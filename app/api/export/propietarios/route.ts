import { NextResponse, type NextRequest } from "next/server";

import { getCurrentProfile } from "@/lib/core/auth";
import { createExcelFile } from "@/lib/excel-export";
import { fetchAll } from "@/lib/excel-import";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type OwnerExportPet = { nombre: string; numero_carnet: string | null };
type OwnerExportRow = {
  empresas?: { nombre: string } | null; nombre: string;
  ciudad?: string | null; direccion?: string | null;
  telefono?: string | null; whatsapp?: string | null; email?: string | null;
  tipo_documento?: string | null; numero_documento?: string | null;
  estado?: string | null; notificaciones_whatsapp?: boolean | null;
  tags?: string[] | null; fuente?: string | null;
  propietarios_mascotas?: Array<{ mascotas: OwnerExportPet | null }>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.redirect(new URL("/login", request.url));
  const admin = getSupabaseAdmin();

  const owners = await fetchAll<OwnerExportRow>((from, to) => {
    let query = admin.from("propietarios").select(`*, empresas(nombre), propietarios_mascotas(mascotas(nombre, numero_carnet))`);
    if (profile.rol !== "super_admin") query = query.eq("empresa_id", profile.empresa_id);
    return query.order("nombre").range(from, to);
  });

  const includeCompany = profile.rol === "super_admin";
  const columns = [
    ...(includeCompany ? [{ header: "Empresa", key: "empresa", width: 24 }] : []),
    { header: "Nombre propietario", key: "nombre", width: 28 },
    { header: "Ciudad", key: "ciudad", width: 18 },
    { header: "Dirección", key: "direccion", width: 28 },
    { header: "Teléfono", key: "telefono", width: 18 },
    { header: "WhatsApp", key: "whatsapp", width: 18 },
    { header: "Email", key: "email", width: 28 },
    { header: "Tipo de documento", key: "tipo_documento", width: 20 },
    { header: "Número de documento", key: "numero_documento", width: 22 },
    { header: "Estado", key: "estado", width: 14 },
    { header: "Notificaciones WhatsApp", key: "notificaciones_whatsapp", width: 24 },
    { header: "Tags", key: "tags", width: 28 },
    { header: "SEDE", key: "fuente", width: 24 },
    { header: "Números de carnet", key: "numeros_carnet", width: 32 },
    { header: "Mascotas", key: "mascotas", width: 34 }
  ];
  const rows = owners.map((owner) => {
    const pets = (owner.propietarios_mascotas || []).map((relation) => relation.mascotas).filter((pet): pet is OwnerExportPet => Boolean(pet));
    return {
      ...(includeCompany ? { empresa: owner.empresas?.nombre || "" } : {}),
      nombre: owner.nombre,
      ciudad: owner.ciudad || "",
      direccion: owner.direccion || "",
      telefono: owner.telefono || "",
      whatsapp: owner.whatsapp || "",
      email: owner.email || "",
      tipo_documento: owner.tipo_documento || "",
      numero_documento: owner.numero_documento || "",
      estado: owner.estado || "",
      notificaciones_whatsapp: owner.notificaciones_whatsapp ? "Sí" : "No",
      tags: (owner.tags || []).join(", "),
      fuente: owner.fuente || "",
      numeros_carnet: pets.map((pet) => pet.numero_carnet).filter(Boolean).join(", "),
      mascotas: pets.map((pet) => pet.nombre).join(", ")
    };
  });

  const buffer = await createExcelFile({ sheetName: "Propietarios", columns, rows });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="propietarios-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Cache-Control": "no-store"
    }
  });
}
