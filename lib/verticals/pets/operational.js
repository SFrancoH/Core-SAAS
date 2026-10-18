import "server-only";

import { requireProfile } from "@/lib/core/auth";

export async function requireOperationalProfile() {
  return requireProfile(["super_admin", "empresa_admin", "veterinario"]);
}

export function applyCompanyScope(query, profile) {
  if (profile.rol === "super_admin") return query;
  return query.eq("empresa_id", profile.empresa_id);
}

export function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  if (!year || !month || !day) return String(value);
  return `${day}/${month}/${year}`;
}

export function sanitizeSearch(value) {
  return String(value || "").trim().slice(0, 100).replace(/[%_,()]/g, " ");
}
