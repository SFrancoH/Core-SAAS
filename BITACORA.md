# BITÁCORA — Core SaaS

Registro de continuidad del **producto Core SaaS**, no de una migración. La bitácora refleja implementaciones reales, decisiones y resultados de pruebas.

## Estados permitidos
`DEFINIDO` → `IMPLEMENTADO` → `BD APLICADA` (si aplica) → `PROBADO LOCAL` → `DESPLEGADO` → `VERIFICADO EN PRODUCCIÓN`. También `BLOQUEADO` o `REVERTIDO`. Un documento o commit no acredita producción.

## 2026-10-17 — Definición inicial de Core SaaS
- **Estado:** DEFINIDO.
- **Objetivo:** plataforma multiempresa con núcleo global, verticales independientes y complementos comunes.
- **Base de desarrollo:** código PETS existente; Next.js, Supabase Auth/PostgreSQL y tablas PETS del repositorio.
- **Decisión DATA-001:** `public.empresas.id uuid` es identidad de empresa de todo Core. No crear otra tabla de empresas para PULSE.
- **Decisión AUTH-001:** `auth.users` es identidad de usuarios; mantener `public.usuarios` y diseñar roles/membresías globales separadas.
- **Decisión MOD-001:** Core controla licencias; cada vertical es propietaria de sus entidades.
- **Decisión INT-001:** parser GHL global y adaptadores por vertical; política de entrega/reintentos es específica de cada evento.
- **SQL ejecutado:** ninguno en esta entrega.
- **Código operativo modificado:** ninguno; solo documentos y carpetas de referencia.
- **Pruebas de aplicación/DB:** no ejecutadas en esta entrega; la inspección de archivos del repositorio no sustituye las pruebas.
- **Próximo paso:** C01, verificar el esquema real de Supabase Core.

## Plantilla para cada nueva entrada
```text
### AAAA-MM-DD — Fase / función
Estado:
Objetivo:
Reglas y contratos afectados:
Archivos:
Tablas/migración/versiones:
Entorno afectado:
Pruebas realmente ejecutadas y resultado:
PR/commit/deployment:
Riesgos y siguiente acción:
```
No incluir secretos, URLs privadas, datos clínicos o personales ni tokens en esta bitácora.

## 2026-10-17 — Núcleo de código y separación PETS
- **Estado:** IMPLEMENTADO EN CÓDIGO de rama; migración DB no aplicada.
- **Objetivo:** mantener rutas existentes PETS y convertir su autenticación, permisos operativos y catálogos en módulos dentro de Core SaaS.
- **Cambios:** `lib/core/auth.js`, `lib/core/access.mjs`, `lib/core/permissions.mjs`, `lib/core/authorization.js`; `lib/verticals/pets/*`; adaptadores compatibles en `lib/auth.js`, `lib/operational.js`, catálogos anteriores; parser global `lib/integrations/ghl-payload.mjs`, adoptado en la integración de contactos PETS; pantallas con imports actualizados.
- **Contratos:** roles históricos de PETS conservados; API de nuevos módulos usa `core_autorizar_operacion` con permiso, empresa y licencia. Si no existe la RPC/entitlement se deniega; no añadir verificaciones de licencia a todas las rutas antiguas antes de instalar/probar SQL.
- **SQL:** `supabase/migrations/010_core_access.sql` **redactado, no ejecutado**; `supabase/design/PREFLIGHT_CORE.sql` preparado.
- **Pruebas:** `node --test` de 7 escenarios puros de scopes/parsing reproducidos localmente; todavía falta `npm ci`, `npm run build`, pruebas de DB y E2E sobre el repositorio.
- **Operación:** ninguna conexión a Supabase, ningún cambio de variables, deployment ni despliegue afirmado.
- **Pendiente:** ejecutar preflight en Supabase Core, ensayar SQL 010 en entorno de prueba y completar autorización de nuevas rutas; luego PULSE crear proyecto.

## 2026-10-18 — Estandarización TypeScript de Core SaaS
- **Estado:** IMPLEMENTADO EN CÓDIGO al confirmar commit; no cambia base de datos.
- **Decisión TS-001:** todo desarrollo nuevo utiliza TypeScript `.ts/.tsx`; `tsconfig.json` estricto con `allowJs` temporal únicamente para el JavaScript PETS ya existente.
- **Estructura:** carpetas de Core, verticales PETS/PULSE, módulos, integraciones, documentación y SQL confirmadas. PULSE y complementos siguen sin implementar funcionalidad.
- **Archivos:** `lib/core/{auth,access,permissions,authorization}.ts`, `lib/verticals/pets/*.ts`, `lib/integrations/ghl-payload.ts`, `tests/core-contracts.test.ts`, `tsconfig.json`, `package.json`, `package-lock.json`, reglas/CI.
- **Compatibilidad:** se conservan rutas `.js` PETS y adaptadores de importación; se reemplaza el `jsconfig.json` por `tsconfig.json` sin cambiar la ruta pública ni el contrato de base de datos.
- **SQL:** sin ejecutar; `010_core_access.sql` pendiente de verificación/instalación controlada.
- **Pruebas:** resultados documentados en el PR/CI correspondiente; pruebas con Supabase real y E2E pendientes.

## 2026-10-18 — TypeScript PETS, frontend global y Core Admin
- Estado: IMPLEMENTADO EN CÓDIGO, sujeto a CI, sin modificación de base de datos.
- Rutas, acciones, componentes, importadores y utilidades PETS renombrados .ts/.tsx sin cambiar URLs ni APIs.
- Core Admin: lib/core/admin/overview.ts, components/layouts/core-admin-header.tsx, components/ui/stat-card.tsx y páginas /super-admin y /super-admin/apariencia.
- Sistema visual: styles/tokens.css contiene paleta, transparencias, radios y tipografía; app/globals.css consume variables en lugar de valores HEX; styles/shell.css organiza administración.
- Estado de tipado: algunos archivos heredados todavía llevan @ts-nocheck; deben tiparse realmente por fases. No introducir nuevos JS.
- SQL 010 no aplicado; Supabase y PULSE productivo sin cambios. Pruebas de integración clínica y visuales pendientes.
