# Core SaaS
Módulos centrales implementados en TypeScript: `auth.ts`, `access.ts`, `permissions.ts`, `authorization.ts`. La autorización vía RPC requiere SQL 010 aplicado; nunca asumirlo solo por existir el código. **Todo cambio nuevo en `.ts`/`.tsx`.**

## Sedes unificadas (UNI-001)
Core será el **único propietario** del catálogo de sedes por empresa y de los grants para usuarios con acceso a una o varias sedes. `empresa_id` sigue aislando datos entre clientes; `sede_id` permite localizar eventos/recursos sin duplicar entidades maestras ni multiplicar aplicaciones.
Regla definida en `docs/UNIFICACION_MULTISEDE.md`; `core.sedes` no está implementado todavía.
