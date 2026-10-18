// La sede procede de fuente, no del empresa_id ni de otra entidad.
export function mostrarSede(fuente: unknown): string {
  const value = typeof fuente === "string" ? fuente.trim() : "";
  return value || "Sin sede registrada";
}
