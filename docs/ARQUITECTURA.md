# Arquitectura de Core SaaS

Core SaaS es un **monolito modular**: una aplicación principal y dominios lógicos separados, no un conjunto de aplicaciones que deben desplegarse juntas a la fuerza. Se utiliza Next.js, React, **TypeScript estricto obligatorio para toda la aplicación** y PostgreSQL en Supabase. No hay rutas ni adaptadores JS de aplicación.

## Estructura de código
- `app/`: rutas, APIs y vistas Next.js, incluidas las pantallas PETS existentes.
- `components/`: componentes visuales reutilizables; lógica de negocio en casos de uso.
- `lib/core/`: empresa activa, identidad, autorización, licencias y auditoría.
- `lib/verticals/pets/`, `lib/verticals/pulse/`: casos de uso de cada vertical. Extraer/implementar por función, no mover de golpe la aplicación PETS.
- `lib/modules/`: inventario, facturación, agenda y otros complementos que no conocen las tablas internas de una vertical.
- `lib/integrations/`: proveedores externos, parsers, firma/Bearer, contratos y estados de entrega.
- `supabase/migrations/`: SQL aprobado y versionado; `supabase/design/` contiene diseños que no se ejecutan automáticamente.
- `docs/verticales/`: reglas exclusivas de cada negocio.

## Regla de acoplamiento
Ruta HTTP → autenticación + organización + permiso + licencia → caso de uso del dominio → transacción PostgreSQL → evento de integración opcional. La lógica de un módulo solo se consulta mediante su interfaz; prohibido importar tablas internas de otra vertical.

## Base de datos
`public.empresas(id uuid)` y `auth.users` son entidades centrales actuales. Se diseñan tablas nuevas de licencias bajo `core`, tablas de rifas bajo `pulse`. PETS mantiene inicialmente sus tablas clínicas `public` para no alterar comportamiento por reorganización estética. FKs compuestas y RLS refuerzan aislamiento.

## Límites de responsabilidad
- La base de datos decide unicidad, estados transaccionales, integridad y dinero; React nunca es autoridad de reservas.
- Las rutas no ejecutan operaciones pesadas indefinidas; jobs/colas duraderas solo donde hacen falta.
- Privilegios administrativos solo en servidor; `service_role` requiere autorización de aplicación porque evade RLS.
- APIs versionadas y webhooks tolerantes en lectura pero estrictos en seguridad.
- No son necesarias nuevas apps, nuevos stacks o nuevos proyectos Supabase para crear una carpeta.

**Estado:** diseño de destino. Ninguna carpeta vacía significa módulo funcional.

## Estado de integración de la base PETS
Desde la primera organización de código, `lib/core/auth.ts` mantiene la lógica compartida de sesiones; `lib/verticals/pets/operational.ts` contiene el comportamiento operativo veterinario y sus catálogos. Los imports históricos se mantienen como **adaptadores** para compatibilidad; las pantallas actuales usan preferentemente las nuevas rutas. `lib/core/authorization.ts` ofrece la autorización para casos de uso Core futuros y requiere la RPC del SQL 010 antes de usarse. **No afirmar que la licencia ya protege las rutas PETS heredadas**: deben incorporarse gradualmente con pruebas.

## Estandarización de lenguaje
Toda la aplicación usa TypeScript; `tsconfig.json` activa `strict: true`, `allowJs: false` y CI `tsc --noEmit`. Los tipos de la base Supabase real todavía deben generarse después del preflight C01. No cambiar a microservicios por este requisito.

## Estructura frontend implementada
- app/super-admin: Core Admin global; roles super_admin y casos de uso de lib/core/admin.
- app/mascotas, app/propietarios, app/registros, app/empresa: portal PETS.
- components/layouts: shells por contexto (global/vertical); components/ui: controles comunes.
- styles/tokens.css: fuente única de identidad visual; app/globals.css: estilos de PETS y generales; styles/shell.css: shell y vistas Core Admin.
- Las URLs existentes se conservan. Toda nueva funcionalidad en TypeScript. Archivos convertidos con @ts-nocheck deben recibir tipado progresivo.

## Identidad y selector global (C11)
- `/login`: único inicio de sesión; `/portal`: empresas y verticales habilitadas por membresía, licencia y permiso; `/super-admin`: propietario global.
- `lib/core/roles.ts`: cuatro roles canónicos con compatibilidad de los nombres PETS antiguos. `lib/core/portal-access.ts`: resolutor server-only de acceso; si falta RPC 011, solo se conserva flujo PETS legacy.
- `core.accounts` + `core.memberships` + `core.entitlements` + `core.membership_permissions`: identidad N:M y aislamiento por empresa y vertical (SQL 010/011 **no ejecutados**).
- `/super-admin/soporte`: vista como usuario temporal **solo lectura**; el proxy bloquea rutas operativas durante una sesión soporte; ninguna API clínica asume la identidad del sujeto.
- Falta convertir rutas PETS y RLS históricos para usar una empresa activa seleccionada; hasta entonces el selector no permite operaciones PETS multiempresa. Ver `docs/IDENTIDAD_ACCESO_MULTIEMPRESA.md`.

## UNI-001 — Una empresa, múltiples sedes y una sola plataforma
**Regla global para Core, PETS, PULSE y TODOS los módulos:** `docs/UNIFICACION_MULTISEDE.md`.

La jerarquía será `auth.users → core.memberships → public.empresas → core.sedes` (0..N) y permisos efectivos por empresa/vertical + sede cuando aplique. `empresa_id` es el límite de aislamiento; `sede_id` es la unidad operativa, NO otro tenant. La empresa comparte datos maestros: mascota, propietario, cliente, SKU, proyecto, etc. Las consultas, agendas, stock físico, caja y otros eventos mantienen sede de operación y actor; una ficha no se duplica porque se atienda en A y B.

El usuario con permisos de lectura de toda la empresa puede buscar en todas sus sedes; el filtro por sede es un criterio de consulta, no otra autenticación. Operar en una sede requiere permiso específico y valida empresa, sede y recurso en servidor + RLS. «Todas» es una opción de lectura/consolidación; no se permiten escrituras sin sede concreta cuando la operación depende de una ubicación. Las verticales consumen el mismo catálogo de sedes Core, sin tablas redundantes por producto.

**Estado:** diseño, no despliegue. PETS utiliza hoy `fuente text` y listas `SEDE NORTE/SUR`; `core.sedes`, grants y políticas multisede todavía necesitan preflight y migraciones versionadas. Las rutas C13 están orientadas a multiempresa, no resuelven por sí solas los permisos de sede.
