import { NextResponse, type NextRequest } from "next/server";

import { getCurrentProfile } from "@/lib/core/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const admin = getSupabaseAdmin();
  let query = admin
    .from("registros_mascotas_pendientes")
    .select("estado, mascota_id, propietario_id, ultimo_error")
    .eq("id", id);

  if (profile.rol !== "super_admin") query = query.eq("empresa_id", profile.empresa_id);
  const { data } = await query.maybeSingle();
  if (!data) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
