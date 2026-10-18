import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SUPPORT_COOKIE, isBlockedDuringSupport } from "@/lib/core/support-policy";
import { refreshSupabaseSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // La vista de soporte usa las credenciales reales del propietario; por eso
  // jamás puede acceder a una ruta de trabajo mientras esa cookie esté activa.
  if (request.cookies.has(SUPPORT_COOKIE) &&
      isBlockedDuringSupport(request.nextUrl.pathname)) {
    if (request.method === "GET" && !request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.redirect(new URL("/super-admin/soporte", request.url));
    }
    return new NextResponse("Modo soporte: operación prohibida", { status: 403 });
  }
  return refreshSupabaseSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
