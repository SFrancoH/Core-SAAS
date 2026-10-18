"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/core/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { UUID_RE } from "@/lib/core/access";
import { SUPPORT_COOKIE, SUPPORT_DURATION_SECONDS } from "@/lib/core/support-policy";
import { canStartSupportSession } from "@/lib/core/roles";

export async function beginSupportView(formData: FormData) {
  const actor = await requireProfile(["super_admin"]);
  const [subjectId = "", companyId = ""] = String(formData.get("destino") ?? "").trim().split("|");
  const reason = String(formData.get("motivo") ?? "").trim();

  if (!UUID_RE.test(subjectId) || !UUID_RE.test(companyId) ||
      !canStartSupportSession("super_admin",subjectId,actor.id,reason)) {
    redirect("/super-admin/soporte?error=datos");
  }

  const { data, error } = await getSupabaseAdmin().rpc("core_support_begin", {
    p_actor_id: actor.id, p_subject_id: subjectId,
    p_empresa_id: companyId, p_reason: reason
  });
  if (error || typeof data !== "string" || !UUID_RE.test(data)) {
    redirect("/super-admin/soporte?error=no_disponible");
  }

  const jar = await cookies();
  jar.set(SUPPORT_COOKIE, data, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: SUPPORT_DURATION_SECONDS
  });
  redirect("/super-admin/soporte");
}

export async function endSupportView() {
  const actor = await requireProfile(["super_admin"]);
  const jar = await cookies();
  const sessionId = jar.get(SUPPORT_COOKIE)?.value;
  if (sessionId && UUID_RE.test(sessionId)) {
    // Revocar en servidor incluso si el usuario elimina después su cookie.
    const { error } = await getSupabaseAdmin().rpc("core_support_end", {
      p_actor_id: actor.id, p_session_id: sessionId
    });
    if (error) {
      // Nunca dejar la cookie tras un error de DB; el registro expira en 15 min.
      console.error("No fue posible revocar sesión de soporte desde la RPC", { code: error.code });
    }
  }
  jar.delete(SUPPORT_COOKIE);
  redirect("/super-admin/soporte");
}
