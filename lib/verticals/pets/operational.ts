import "server-only";
import { requireProfile, type CoreProfile } from "@/lib/core/auth";

export async function requireOperationalProfile(): Promise<CoreProfile> {
  return requireProfile(["super_admin", "empresa_admin", "veterinario"]);
}

/** Mantiene el filtrado empresarial usado por las pantallas PETS. */
export function applyCompanyScope<T extends { eq(column: string, value: string): T }>(
  query: T,
  profile: Pick<CoreProfile, "rol" | "empresa_id">
): T {
  if (profile.rol === "super_admin") return query;
  if (!profile.empresa_id) throw new Error("Empresa requerida");
  return query.eq("empresa_id", profile.empresa_id);
}

export function formatDate(value: unknown): string {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  if (!year || !month || !day) return String(value);
  return `${day}/${month}/${year}`;
}

export function sanitizeSearch(value: unknown): string {
  return String(value || "").trim().slice(0, 100).replace(/[%_,()]/g, " ");
}
