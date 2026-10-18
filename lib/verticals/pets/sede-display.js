// Valor mostrado en la UI. No reemplazar con empresa_id ni deducir la sede
// desde datos de otra entidad: fuente es el único origen para SEDE.
export function mostrarSede(fuente) {
  const value = typeof fuente === "string" ? fuente.trim() : "";
  return value || "Sin sede registrada";
}
