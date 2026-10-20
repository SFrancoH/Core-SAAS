import { NextResponse, type NextRequest } from "next/server";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/core/auth";
import { UUID_RE } from "@/lib/core/access";

export const dynamic = "force-dynamic";

/** C14: ruta de compatibilidad. Nunca devolver descargas transversales con service_role. */
export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.redirect(new URL("/login", request.url));
  // Un super_admin debe elegir una empresa explícitamente en el portal Core.
  if (!profile.empresa_id || !UUID_RE.test(profile.empresa_id)) notFound();
  const url = new URL(`/api/core/empresas/${profile.empresa_id}/pets/export/mascotas`, request.url);
  return NextResponse.redirect(url, 307);
}
