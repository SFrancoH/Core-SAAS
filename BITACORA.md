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

## 2026-10-18 — Tipado estricto PETS y controles de regresión
- **Estado:** IMPLEMENTADO EN CÓDIGO de PR #5; pruebas de CI registradas en el PR. La base de datos no ha sido modificada.
- **Objetivo:** cerrar los `@ts-nocheck` heredados sin alterar URLs, consultas veterinarias, flujos de pago o Supabase.
- **Alcance de código:** componentes de formularios propietarios/mascotas y confirmación; cookies y sesión Supabase; importación, exportación y lectores Excel; rutas webhooks/estados/descargas; paneles PETS y acciones de crear usuarios, registros y consultas; formulario clínico, procedimientos, medicamentos y línea de tiempo.
- **Tipos:** parámetros Next.js `params`/`searchParams`, `FormData`, datos de propietarios/mascotas, consultas, veterinarios, medicamentos, eventos, búsquedas, errores `unknown`, lectores Excel y buffers de salida.
- **Correcciones derivadas del chequeo:** nullabilidad, invariantes de medicamentos, tipos de relaciones, ausencia de cliente Auth, callbacks, fechas, tipos de filas y campos de actualización clínica sin mutar la autoría original.
- **Política:** `tsconfig.json` `strict` y `allowJs: false`; prueba de arquitectura bloquea JavaScript y directivas `@ts-nocheck`/`@ts-ignore` en código TS.
- **Límite de verificación:** el adaptador administrativo `lib/supabase/admin.ts` conserva **un `any` explícito** para tablas/RPC de Supabase no generadas. No afirmar tipado de esquema real hasta C01. Las pruebas unitarias/build no validan RLS ni datos del entorno Supabase.
- **SQL/operación:** `010_core_access.sql` no ejecutado; sin cambios a producción, credenciales o PULSE.
- **Pendiente:** generar tipos Database de la instancia Core validada, eliminar el `any` del adaptador y ejecutar pruebas E2E clínicas, aislamiento A/B y regresión de integraciones.

## 2026-10-18 — Acceso global Core SaaS, roles y modelo multiempresa
- **Estado:** IMPLEMENTADO EN CÓDIGO Y SQL VERSIONADO, sujeto a CI y preflight. **NO** activado en Supabase ni producción.
- **Objetivo:** un login CORE SAAS, identidad global y membresías por empresa, roles Super-Admin (uno), Super-User, Admin y User, permisos granulares por vertical y aislamiento real.
- **Código:** `lib/core/roles.ts` (roles, delegación, invariantes), `lib/core/portal-access.ts` (licencias y membresías; PETS legacy limitado), `lib/core/auth.ts` (resolver identidad Core solo con RPC instalada), `app/login`, `app/panel`, `app/portal`, `lib/core/support-policy.ts`, `app/super-admin/soporte`, `proxy.ts` y enlace en Core Admin.
- **SQL redactado:** `supabase/migrations/011_core_identity_multitenant.sql` depende de 010; `core.accounts`, `core.platform_staff`, `core.memberships.company_role`, `core.membership_permissions`, `core.platform_permission_grants`, `core.support_sessions`; RPC de identidad, licencias, autorización, cuentas, personal, membresías multiempresa, soporte y directorio.
- **Auditoría diseñada:** registro del creador/actor real, empresa, sujeto, rol/permisos, inicio y cierre de soporte. El modo soporte solo muestra permisos/licencias y bloquea rutas operativas, no reemplaza Auth del usuario.
- **Compatibilidad preservada:** `public.usuarios.rol` (enum PETS) y `empresa_id` legacy permanecen sin cambios; el acceso a PETS por empresa adicional se bloquea hasta adaptar todos los filtros y RLS. PULSE sigue sin frontend productivo en Core.
- **Seguridad:** sin licencias inventadas desde frontend; fail-closed cuando falta 011 para nuevas funciones. Sin leer datos de Supabase real ni desplegar SQL; pruebas de aislamiento real/E2E pendientes.
- **Pendientes:** preflight C01, ensayo de SQL 010/011, API/UI de invitación de usuarios y selector de permisos, adaptación completa de PETS multiempresa, pruebas de soporte y auditoría contra BD real.

## 2026-10-18 — C12: gestión de usuarios y permisos por empresa
- **Estado:** IMPLEMENTADO EN CÓDIGO del PR #7, NO ACTIVADO EN BD; requerirá CI y pruebas E2E.
- **Objetivo:** aplicar los cuatro roles en gestión real: Super-Admin (único), Super-User (empleado interno sin acceso implícito), Admin (empresa), User (empresa), con un login Core, membresía N:M y permisos por vertical.
- **Frontend:** `app/super-admin/usuarios`, `app/empresa/usuarios`, `app/portal/empresa/[id]/usuarios`, `components/core/user-forms.tsx`; el catálogo muestra solo permisos delegables de verticales licenciadas.
- **Backend:** `app/core-users/actions.ts` valida identidad desde `getCurrentProfile`, empresa por RPC `core_autorizar_operacion`, permisos delegables, longitud de contraseña, y crea cuenta con Supabase Auth + RPC. En errores intenta borrar la identidad Auth; se audita creador y asignaciones en SQL.
- **SQL versionado:** `011_core_identity_multitenant.sql` recibió corrección de delimitadores de funciones y RPCs `core_permission_catalog`, `core_company_members` y `core_find_account`. Depende de 010, NO se ejecutó en ninguna instancia real.
- **Aislamiento:** Admin solo Admin/User de su empresa y no concede permisos ajenos; Super-User no hereda autoridad de propietario. Una cuenta puede pertenecer a varias empresas con role/perms distintos, pero PETS sigue usando `public.usuarios.empresa_id` y por tanto **NO se habilita una segunda empresa en sus pantallas**.
- **Superadmin como usuario:** vista diagnóstica en `super-admin/soporte` solo permite ver identidad, licencias y permisos, con actor real, motivo, expiración y auditoría; NO sustituye la identidad Auth, no permite operar la app como el usuario.
- **Pendientes críticos:** generar tipos de BD, validar migraciones 010 y 011 con `PREFLIGHT_CORE.sql`, E2E A/B/usuarios, migración de RLS PETS a membresías y empresa seleccionada, aceptación de invitación para Admin si correo ya existe. Sin deploy a Supabase ni intervención en PULSE.

### 2026-10-18 — Defensa adicional del modo soporte
- **Estado:** Implementado en código del PR #7, bajo pruebas CI.
- **Motivo:** el bloqueo de rutas del proxy no basta para Next.js Server Actions: un POST puede intentar ejecutar un identificador de acción desde otra URL.
- **Cambio:** `lib/core/support-guard.ts` consulta la cookie `httpOnly` del modo soporte y rechaza escrituras; todas las acciones de creación/edición/importación/usuarios/empresas y login lo invocan antes de mutar. `logout` y los controles exclusivos de inicio/cierre del soporte quedan habilitados para salir con seguridad.
- **Validación:** prueba de cobertura de acciones y CI; no sustituye una prueba con Supabase ni pretende crear un JWT del sujeto.

## 2026-10-18 — C13: inicio PETS multiempresa (contexto de lectura)
- **Estado:** IMPLEMENTADO EN RAMA/PR #8, SQL 012 NO APLICADO. Pendiente verificación de integración PostgreSQL/RLS.
- **Objetivo:** dejar de depender de public.usuarios.empresa_id para nuevas consultas PETS, comprobando el tenant por membresía Core, licencia y permiso.
- **Código:** lib/verticals/pets/tenant-context.ts y tenant-policy.ts; nuevas vistas read-only /portal/empresa/[id]/pets/mascotas, /mascotas/[petId] y /propietarios.
- **Base:** supabase/migrations/012_pets_multitenant_rls.sql incluye función RLS private.pets_tenant_allowed y RPC public.core_pets_tenant_access. No hay SQL ejecutado ni acceso real a Supabase en este trabajo.
- **Seguridad:** service_role solo después de verificar actor/tenant con RPC, queries filtradas por empresa_id, revisión de filas devueltas; suspensión/revocación debe denegar. Feature flag CORE_PETS_MULTI_TENANT_READ_ENABLED deshabilitado por defecto.
- **Preflight:** supabase/design/PREFLIGHT_PETS_MULTIEMPRESA.sql de solo lectura; requiere revisar migraciones 010/011, políticas, roles y backup.
- **Compatibilidad:** PETS legacy y PULSE intactos. No hay segunda empresa habilitada para escrituras, exportaciones ni consultas clínicas antiguas.
- **Pruebas:** pruebas unitarias y de contratos CI del PR. Pendientes tests A/B con JWT/RLS de Supabase en staging, E2E y pruebas de regresión antes de aplicar SQL.
- **Fases siguientes:** C14 lecturas legacy y C15/C16 escrituras, claves foráneas y eliminación de empresa_id singular como fuente de autorización.
