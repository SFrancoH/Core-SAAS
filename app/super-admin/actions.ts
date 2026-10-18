"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireProfile } from "@/lib/core/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function createCompany(formData: FormData) {
  const profile = await requireProfile(["super_admin"]);
  const nombre = String(formData.get("nombre") || "").trim();

  if (nombre.length < 2 || nombre.length > 120) {
    redirect("/super-admin?error=nombre");
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("empresas").insert({
    nombre,
    creada_por: profile.id
  });

  if (error) {
    redirect("/super-admin?error=empresa");
  }

  revalidatePath("/super-admin");
  redirect("/super-admin?ok=empresa");
}
