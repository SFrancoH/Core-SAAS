# Core SaaS

Plataforma SaaS modular y multiempresa. **PETS** es la primera vertical disponible en código; PULSE (rifas, boletas, eventos) se incorpora por funcionalidades. Verticales planeadas: AURA (estética), VISION (oftalmología), DRIVE (movilidad), NEURO (educación), LENS (ópticas).

El producto se desarrolla sobre la aplicación Next.js que ya existe en este repositorio. **No es un plan de migración de repositorios**. El objetivo es incorporar casos de uso nuevos a una arquitectura central, sin reconstruir todas las pantallas ni desplegar módulos antes de tiempo.

## Documentación del proyecto
- [AGENTS.md](AGENTS.md): reglas obligatorias para la IA.
- [PLAN_DESARROLLO.md](PLAN_DESARROLLO.md): secuencia de construcción.
- [BITACORA.md](BITACORA.md): decisiones, estado y evidencias.
- [Arquitectura](docs/ARQUITECTURA.md).
- [Modelo de datos, permisos y licencias](docs/MODELO_DATOS_PERMISOS_LICENCIAS.md).
- [Contratos de integración](docs/CONTRATOS_INTEGRACIONES.md).
- [Cómo agregar una funcionalidad](docs/COMO_AGREGAR_FUNCIONALIDAD.md).
- [PETS](docs/verticales/PETS.md) y [PULSE](docs/verticales/PULSE.md).

## Stack y ejecución
Next.js 16, React 19, Supabase Auth, PostgreSQL y ExcelJS. **TypeScript es el lenguaje obligatorio para todo desarrollo nuevo**. Core y los módulos PETS ya organizados utilizan archivos `.ts`; los archivos `.js` existentes de PETS se mantienen por compatibilidad mientras se convierten por etapas. `tsconfig.json` habilita `strict` y `allowJs` para este tránsito, sin permitir nuevo código JavaScript.

```bash
npm install
npm run dev
npm test       # Node.js 22, pruebas TypeScript
npm run typecheck
npm run build
```

Configurar en `.env.local` o en el servidor, **nunca en Git**:
```env
SUPABASE_URL=...
SUPABASE_SECRET_KEY=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```
`SUPABASE_SECRET_KEY` es exclusivamente privada y no lleva prefijo `NEXT_PUBLIC_`.

El directorio `supabase/migrations` contiene PETS 001–009 y el **diseño aún no aplicado** `010_core_access.sql` (Core: licencias, roles, permisos y membresías). Confirmar qué migraciones se ejecutaron realmente antes de aplicar SQL. Las carpetas nuevas delimitan la aplicación: autenticación compartida en `lib/core` y catálogos y permisos PETS en `lib/verticals/pets`. Los módulos nuevos no se consideran implementados por crear sus carpetas.

## Primera entrega de Core
Conservar PETS operativo, inventariar la base de datos actual, construir permisos/licencias centrales y agregar la primera función «Crear proyecto PULSE» siguiendo el contrato Core. No copiar todo PULSE de golpe ni escribir en una base de datos ajena a este proyecto.

## Estructura confirmada

```text
Core-SAAS/
├── AGENTS.md
├── PLAN_DESARROLLO.md
├── BITACORA.md
├── README.md
├── app/                     # Rutas PETS actuales
├── components/              # Componentes existentes
├── lib/
│   ├── core/                # Autenticación, autorización y permisos TypeScript
│   ├── verticals/
│   │   ├── pets/            # Dominio PETS TypeScript
│   │   └── pulse/           # Dominio previsto, aún sin casos de uso
│   ├── modules/             # Complementos transversales
│   └── integrations/        # Parser compartido GHL TypeScript
├── docs/
│   ├── ARQUITECTURA.md
│   ├── MODELO_DATOS_PERMISOS_LICENCIAS.md
│   ├── CONTRATOS_INTEGRACIONES.md
│   ├── COMO_AGREGAR_FUNCIONALIDAD.md
│   └── verticales/
│       ├── PETS.md
│       └── PULSE.md
└── supabase/
    ├── migrations/          # PETS 001–009 + Core 010 sin aplicar
    └── design/              # Documentos y consultas de revisión
```

Esta estructura describe carpetas reales del repositorio; no significa que PULSE, licencias en DB o módulos compartidos ya estén habilitados.

## Frontend y estilos centralizados
Core Admin (superadministrador) vive en /super-admin, con diseño global en /super-admin/apariencia. La operación de empresas permanece diferenciada de PETS. Ver docs/CORE_ADMIN.md y docs/FRONTEND_DESIGN_SYSTEM.md.
El color primario inicial es #147d4a. Para cambiar la estética global, editar styles/tokens.css y desplegar el cambio; nunca reescribir cada vertical.
Todos los archivos PETS se llevan a extensiones TypeScript .ts/.tsx. Los que conservan @ts-nocheck siguen pendientes de tipado interno y pruebas E2E; no deben considerarse completamente comprobados por TypeScript.

## Tipado TypeScript estricto
Todas las rutas, componentes y servicios del proyecto se mantienen en TS/TSX; `tsconfig.json` usa `strict` y `allowJs: false`. Las verificaciones en CI prohíben archivos JavaScript y directivas de supresión de tipado.
**Límite explícito:** el adaptador `lib/supabase/admin.ts` sigue teniendo un tipo dinámico para las tablas/RPC hasta generar `Database` a partir del esquema real de Supabase (fase C01). Las pruebas funcionales contra BD aún son independientes de los tests TypeScript.

## Identidad y acceso multiempresa
`/login` es el único acceso CORE SAAS; `/portal` selecciona empresas y verticales con licencia. Los cuatro roles canónicos son **Super-Admin, Super-User, Admin y User**. El rol de empresa y los permisos se asignan por membresía; veterinario o vendedor son perfiles funcionales de cada producto. Ver [Identidad y aislamiento](docs/IDENTIDAD_ACCESO_MULTIEMPRESA.md).

La ruta `/super-admin/soporte` ofrece una **vista como usuario de solo lectura**, auditada y temporal: no inicia sesión en nombre del sujeto y bloquea operaciones del propietario mientras esté activa. Requiere SQL 011. La migración 011 está versionada, no aplicada. Las rutas PETS históricas aún necesitan adaptar RLS/contexto de usuario multiempresa antes de activarlo completamente.

## Usuarios Core y permisos por vertical
Super-Admin crea Super-User, Admin y User en `/super-admin/usuarios`; Admin crea solo Admin/User para sus empresas desde `/empresa/usuarios` (PETS) o `/portal/empresa/[id]/usuarios` (Core). Una cuenta puede asociarse a varias empresas con permisos distintos; el selector exige empresa + licencia + permiso, también en backend, y cada asignación registra al actor. SQL 010 y 011 **deben revisarse e instalarse en entorno de pruebas** antes de habilitar estas funciones. La apariencia del selector no sustituye RLS.

## PETS multiempresa (C13: piloto read-only)
El contexto y las primeras rutas de mascotas y propietarios por empresa están documentados en docs/MIGRACION_PETS_MULTIEMPRESA.md. La migración supabase/migrations/012_pets_multitenant_rls.sql está versionada, pero NO aplicada. Para habilitar las nuevas rutas se requiere preflight real de Supabase 010/011/012, pruebas de JWT/RLS y la bandera CORE_PETS_MULTI_TENANT_READ_ENABLED=true; por defecto está apagada. Los flujos clínicos antiguos continúan sin soporte para una segunda empresa.

## Unificación multisede — Regla de producto UNI-001
**Una empresa con varias sedes no compra, administra ni utiliza varias instalaciones de software.** Core SaaS ofrece un login, las mismas verticales/complementos activados, **datos maestros únicos por empresa** y operaciones localizadas por sede cuando se necesite.

Ejemplo PETS: el veterinario autorizado encuentra la misma mascota y su historial desde Sede Norte o Sede Sur; puede filtrar las visitas por sede o verlas consolidadas sin crear duplicados. Agenda e inventario mantienen localización física y permisos específicos. PULSE, facturación, reportes y demás complementos obedecerán el mismo principio. El filtro por sede es una ayuda operativa, **no** una autorización.

Requisito formal de arquitectura: [UNI-001 — Unificación y multisede](docs/UNIFICACION_MULTISEDE.md). **Estado:** regla documentada, modelo dinámico `core.sedes` y sus grants pendientes de implementación y validación en Supabase; PETS tiene por ahora la columna histórica `fuente` y sedes codificadas.

## Paquete de despliegue inicial Core y futuro módulo Inventory
El plan funcional de Inventory está en [`docs/modules/INVENTORY_PLAN.md`](docs/modules/INVENTORY_PLAN.md), incluyendo bodegas/altillaje, proveedores N:M, lotes, FEFO/FIFO, JIT, caducidad, ledger y fases I0–I9. **No hay Inventario funcional en este commit.**

La migración combinada Core 010–013 para **staging sin Core previo** está en `supabase/deploy/CORE_UNA_EJECUCION_STAGING.sql` (una transacción, no aplicada). Instrucciones y advertencias: [`docs/DESPLIEGUE_UNICO_CORE_STAGING.md`](docs/DESPLIEGUE_UNICO_CORE_STAGING.md). PETS estricto multiempresa/multisede debe seguir con flag OFF hasta validar RLS real y migrar las escrituras legacy.

## Rama única de desarrollo (octubre 2026)

Los nuevos cambios de licencias y el DDL de PULSE se prueban primero en la rama `desarrollo`. `main` permanece estable. Ver [flujo PowerShell](docs/FLUJO_DESARROLLO_WINDOWS.md), [licencias Core](docs/CORE_LICENCIAS_ADMIN.md) y [SQL PULSE](docs/verticales/PULSE_MIGRACION_CORE.md). **SQL 014/015 todavía no aplicado**; no usar el código de PULSE original contra el esquema Core sin adaptar sus IDs y contratos.
