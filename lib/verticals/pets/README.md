# PETS
Dominio veterinario de Core SaaS. `operational.ts`, `clinical-catalogs.ts`, `pet-catalogs.ts`, `sede-display.ts` son TypeScript. Las rutas antiguas PETS continúan en `app/` con JavaScript compatible hasta conversiones controladas por funcionalidad. No alterar el comportamiento clínico por un cambio de extensión.

## UNI-001 — Ficha única entre sedes
Una mascota y sus propietarios son registros de empresa, con historial consolidado A/B y eventos/consultas que conservan sede de atención. Filtrar por sede nunca crea otra mascota. Las listas actuales de SEDE NORTE/SUR y `fuente` text son legado y requieren migración de datos, catálogo Core y pruebas RLS antes de habilitar sedes arbitrarias.
Ver `docs/UNIFICACION_MULTISEDE.md` y `docs/verticales/PETS.md`.
