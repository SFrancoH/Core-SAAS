# PULSE
Espacio real reservado para casos de uso PULSE **a desarrollar en TypeScript (`.ts` y `.tsx`)** dentro de Core SaaS. Su existencia no significa implementación de proyectos/boletas ni creación de tablas. Adaptar cada función a las identidades, permisos y licencias globales; leer `docs/verticales/PULSE.md`.

## UNI-001 — Proyectos/boletas no duplicados por sede
PULSE tendrá un proyecto y un conjunto de boletas por empresa/proyecto, con oficinas/puntos operativos por sede cuando aplique. No se clona un proyecto ni una boleta por abrir otra sede. Usar el catálogo de sedes de Core, permisos y vistas/reportes consolidados.
Ver `docs/UNIFICACION_MULTISEDE.md`; todavía es diseño, no funcionalidad implementada.

Contrato tipado: `contracts.ts` centraliza validación de consecutivos, salida de Oficina en bloques de 50 y predicados puros para UI. El esquema Core está en `supabase/migrations/015_pulse_core_schema.sql`, **no aplicado**, y no incluye operaciones de negocio.
