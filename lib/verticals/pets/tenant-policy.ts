import { UUID_RE } from "../../core/access.ts";

export type PetTenantPermission =
  | "pets.pet.read"
  | "pets.pet.write"
  | "pets.consultation.read"
  | "pets.consultation.write";

const PET_PERMISSIONS: readonly string[] = [
  "pets.pet.read","pets.pet.write","pets.consultation.read","pets.consultation.write"
];

export function validPetTenantInput(companyId: string, permission: string): boolean {
  return UUID_RE.test(companyId) && PET_PERMISSIONS.includes(permission);
}

/** Verificación posterior a consultas service_role: no mostrar siquiera una
 * fila inesperada si el join/filtro se rompe durante una refactorización. */
export function ensureTenantRows<T extends { empresa_id: string }>(
  rows: readonly T[], companyId: string
): T[] {
  if (!UUID_RE.test(companyId) || rows.some(row=>row.empresa_id!==companyId)) {
    throw new Error("CROSS_TENANT_RESULT_REJECTED");
  }
  return [...rows];
}

export function normalizePetPage(value: string | undefined): number {
  const parsed=Number(value);
  return Number.isSafeInteger(parsed)&&parsed>0?Math.min(parsed,100000):1;
}
