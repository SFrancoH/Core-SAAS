import "server-only";

import { getCurrentProfile } from "@/lib/core/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeCoreRole, type CoreRole } from "@/lib/core/roles";

export type PortalWorkspace = {
  companyId: string;
  companyName: string;
  role: "admin" | "user";
  products: string[];
  canOpenPets: boolean;
};
export type PortalContext = {
  role: CoreRole;
  workspaces: PortalWorkspace[];
  mode: "core" | "legacy_pets";
};

function parseCoreWorkspace(value: unknown): PortalWorkspace | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.company_id !== "string" || typeof row.company_name !== "string") return null;
  if (row.company_active !== true || row.membership_active !== true) return null;
  if (row.role !== "admin" && row.role !== "user") return null;
  const products = Array.isArray(row.products)
    ? row.products.filter((x): x is string => typeof x === "string")
    : [];
  if (!products.length) return null;
  return { companyId: row.company_id, companyName: row.company_name, role: row.role, products, canOpenPets: false };
}

/**
 * El RPC de la migración 011 retorna SOLO memberships activas con licencia.
 * Sin RPC, únicamente el acceso PETS histórico puede continuar: jamás inferir licencia PULSE.
 * No se usa el cliente para autorizar acciones: cada ruta/API debe validar por sí misma.
 */
export async function resolvePortalContext(): Promise<PortalContext | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const role = normalizeCoreRole(profile.rol);
  if (!role) return null;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("core_portal_access", { p_actor_id: profile.id });
  if (!error) {
    if (!Array.isArray(data)) return { role, workspaces: [], mode: "core" };
    const workspaces = data.map(parseCoreWorkspace).filter((item): item is PortalWorkspace => item !== null);
    // PETS histórico aún lee public.usuarios.empresa_id y no tolera cambio de empresa:
    // NO abrir PETS en una membresía distinta hasta convertir el aislamiento/RLS heredado.
    for (const space of workspaces) {
      space.canOpenPets = space.products.includes("PETS") &&
        (role === "super_admin" || space.companyId === profile.empresa_id);
    }
    return { role, workspaces, mode: "core" };
  }

  // La ausencia del RPC es una dependencia de despliegue, no una licencia provisional.
  if (!["42883", "PGRST202"].includes(error.code ?? "")) {
    throw new Error("No fue posible consultar las licencias de Core SaaS.");
  }
  if ((profile.rol !== "empresa_admin" && profile.rol !== "veterinario") || !profile.empresa_id) {
    return { role, workspaces: [], mode: "legacy_pets" };
  }
  const { data: company, error: companyError } = await admin
    .from("empresas").select("id,nombre,activa").eq("id", profile.empresa_id).maybeSingle();
  if (companyError) throw new Error("No fue posible consultar la empresa.");
  const workspaces: PortalWorkspace[] = company?.activa ? [{
    companyId: company.id, companyName: company.nombre, role: role === "admin" ? "admin" : "user",
    products: ["PETS"], canOpenPets: true
  }] : [];
  return { role, workspaces, mode: "legacy_pets" };
}
