"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/core/auth";
import { UUID_RE } from "@/lib/core/access";
import { assertNoSupportMode } from "@/lib/core/support-guard";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PRODUCTS } from "@/lib/core/permissions";

export async function saveCompanyLicense(form: FormData): Promise<void> {
  await assertNoSupportMode();
  const actor = await requireProfile(["super_admin"]);
  const companyId = String(form.get("empresa_id") ?? "");
  const productCode = String(form.get("producto") ?? "");
  const status = String(form.get("estado") ?? "");
  const rawExpiry = String(form.get("vence") ?? "").trim();
  if (!UUID_RE.test(companyId)) redirect("/super-admin");
  const destination = "/super-admin/empresas/" + companyId + "/licencias";
  if (!Object.values(PRODUCTS).includes(productCode as (typeof PRODUCTS)[keyof typeof PRODUCTS]) ||
      !["active", "suspended"].includes(status) ||
      (rawExpiry && !/^\d{4}-\d{2}-\d{2}$/.test(rawExpiry))) {
    redirect(destination + "?error=datos");
  }
  let validUntil: string | null = null;
  if (rawExpiry) {
    const end = new Date(rawExpiry + "T23:59:59.999Z");
    if (Number.isNaN(end.getTime()) || end.toISOString().slice(0, 10) !== rawExpiry ||
        end.getTime() <= Date.now()) redirect(destination + "?error=fecha");
    validUntil = end.toISOString();
  }
  const { data, error } = await getSupabaseAdmin().rpc("core_set_product_entitlement", {
    p_actor_id: actor.id,
    p_empresa_id: companyId,
    p_product_code: productCode,
    p_status: status,
    p_valid_until: validUntil
  });
  if (error || data !== true) redirect(destination + "?error=guardar");
  revalidatePath(destination);
  revalidatePath("/portal");
  redirect(destination + "?ok=licencia");
}
