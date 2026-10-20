# PLAN DE DESARROLLO — Core SaaS

**Versión inicial:** 0.1 · **Fecha base:** 2026-10-17  
**Proyecto:** Core SaaS multiempresa. **Estrategia:** construir cada vertical por funciones completas, dentro del mismo producto.

## 1. Alcance
Core aporta empresas, cuentas, membresías, permisos, licencias, integraciones y auditoría. PETS, PULSE, AURA, VISION, DRIVE, NEURO y LENS son productos verticales. Inventario, facturación, agenda, documentos y analítica son módulos compartidos opcionales. Un cliente puede tener varias verticales activas.

## 2. Estado inicial
- [x] Código PETS presente en Next.js; `app/`, `components/`, `lib/` y migraciones SQL 001–009.
- [x] Modelo en repositorio de `public.empresas(id uuid)`, `public.usuarios` ligado a `auth.users`, mascotas, propietarios y consultas.
- [ ] Verificación del esquema **real** instalado en el Supabase de Core SaaS.
- [~] Autorización Core en código y SQL 010 redactado; **no aplicado a Supabase ni conectado aún a todos los flujos PETS**.
- [ ] Primera función PULSE implantada en este repositorio.
- [ ] Módulos compartidos funcionales.
- [ ] Pruebas E2E y publicación consolidada.

## 3. Fases ejecutables

### C00 — Documentación, estructura y estándar TypeScript
- [x] Estructura `app`, `components`, `lib/core`, `lib/verticals/pets`, `lib/verticals/pulse`, `lib/modules`, `lib/integrations`, `docs` y `supabase` integrada al repositorio.
- [x] Norma de TypeScript obligatorio para código nuevo, `tsconfig.json` estricto y compatibilidad temporal con JavaScript PETS.
- [x] Servicios Core (autenticación, alcance, permisos, autorización), utilidades PETS y parser GHL reorganizados a `.ts`.
- [x] Conversión de todas las rutas/componentes PETS a `.ts/.tsx` y chequeo estático del código. Faltan pruebas funcionales E2E.
- [x] Documentación maestra, modelo de datos, contratos, reglas PETS/PULSE.
- [x] Carpetas previstas sin alterar código de aplicación.
- [~] Pruebas TypeScript de scoping/webhook disponibles; CI debe validar `npm test`, `npm run typecheck` y build. PETS E2E pendiente.
**Criterio:** sin cambios en base de datos ni dependencias; estructura consistente.

### C01 — Inventario de la base Core
- [ ] Ejecutar `supabase/design/PREFLIGHT_CORE.sql` de solo lectura y confirmar columnas, UUID, FKs, RLS, políticas, triggers y migraciones en la BD real.
- [ ] Definir baseline versionado y copia de seguridad/restauración de prueba.
- [ ] Registrar discrepancias SQL-versión/DB real sin ejecutar correcciones destructivas.
**Criterio:** esquema real comprobado y documentado.

### C02 — Autenticación y contexto empresarial
- [ ] Reutilizar `auth.users`, `public.usuarios` y `public.empresas`.
- [~] Helpers Core y SQL 010 diseñados; falta comprobar memberships y autorizar desde la BD, no se permite cambiar de empresa solo por un ID.
- [ ] Pruebas de acceso cruzado empresa A/B, cambio de rol y usuario desactivado.
**Criterio:** una sesión no permite leer/editar datos de otra empresa.

### C03 — Licencias y permisos
- [~] SQL versionado `010_core_access.sql` redactado. **No ejecutado, requiere preflight y validación de dependencias.**
- [ ] Registrar productos y módulos, con PETS como primer producto.
- [ ] Validación de backend y UX para módulos activos/inactivos.
**Criterio:** sin entitlement o permiso, API rechaza la operación.

### C04 — Integraciones estándar
- [x] Parser puro común GHL y pruebas de raíz, Custom Data, mezclas, alias y conflictos; endpoint PETS adaptado.
- [ ] Autenticación de webhook ligada a tenant; validación, auditoría e idempotencia.
- [ ] Políticas por tipo de evento: envío único o reintento idempotente; tests de contrato.
**Criterio:** recepción segura y versionada sin acoplamiento a una vertical.

### C05 — PULSE: Crear proyecto
- [ ] Diseñar tablas `pulse.proyectos` y `pulse.boletas` a partir del modelo Core, sin repetir `empresas`.
- [ ] Crear proyecto con imagen, monto, fecha del premio mayor, anticipados y lote de boletas.
- [ ] Números únicos por proyecto, ceros iniciales, enlace público individual.
- [ ] Panel, listado filtrado por empresa/proyecto, búsqueda y paginación en SQL.
- [ ] Pruebas de duplicidad, atomicidad, cantidad, permisos y empresa A/B.
**Criterio:** proyecto funcional end-to-end con datos ficticios.

### C06 — PULSE: Operación de venta
- [ ] Disponibilidad, asignaciones, vendedores, reservas, pagos, alertas, ganadores.
- [ ] Integraciones GHL según contratos PULSE; no activar reservas antes de pasar pruebas de concurrencia e idempotencia.
**Criterio:** venta consistente, sin doble reserva ni pérdida de saldo.

### C07 — Módulo compartido
- [ ] Inventario o facturación como dominio reutilizable; primera integración PETS y otra cuando exista caso real.
**Criterio:** módulo compartido sin importar las tablas de cada vertical.

### C08 — Calidad y expansión
- [~] Workflow CI agregado; aún faltan backups verificados, auditoría operativa, permisos E2E y monitoreo.
- [ ] Definir regulaciones necesarias para clínicas humanas antes de AURA/VISION.
- [ ] Crear próximas verticales solo con requisitos concretos.
**Criterio:** publicación comercial verificada.

## 4. Trabajo por ticket
Leer reglas → identificar vertical/entidad → definir contrato, permisos/licencia y SQL → hacer prueba → implementar una función → validar → registrar archivos/migración/entorno/resultado/commit en bitácora.

**Siguiente trabajo: C01.** No aplicar SQL de PULSE antes de examinar el Supabase de Core SaaS.

## C09 — Frontend global, Core Admin y código PETS TypeScript
- [x] Rutas, acciones, componentes y utilidades PETS pasados de extensión .js a .ts/.tsx.
- [x] Core Admin separado de la operación PETS con panel global y catálogo visual de verticales.
- [x] Identidad visual única: styles/tokens.css y estilos consumidores.
- [x] Componentes compartidos iniciales tipados y cabecera Core Admin.
- [x] Eliminar las directivas `@ts-nocheck` de los archivos PETS/Core, con contratos TypeScript y verificación CI.
- [ ] Pruebas de la aplicación PETS conectada al Supabase real, permisos, formularios y responsive.
- [ ] Licencias, planes, auditoría y módulos Core reales: requieren SQL 010 aplicado y pruebas.

## C10 — Tipado estricto PETS (2026-10-18)
- [x] Formulario clínico y medicamentos con tipos propios de mascota, veterinario, consulta, historial y procedimientos.
- [x] Rutas de administración, formularios, importación/exportación Excel y API GHL con parámetros, entidades y errores validados.
- [x] Eliminar `@ts-nocheck` de aplicación, componentes y servicios; protegerlo con prueba automática.
- [x] Desactivar `allowJs` en `tsconfig.json` para nuevas funcionalidades.
- [ ] Generar tipos Database directamente del Supabase de Core y eliminar la excepción temporal en `lib/supabase/admin.ts` después del preflight C01.
- [ ] Ejecutar pruebas E2E clínicas, registros, permisos de empresa y webhooks contra un entorno Supabase de pruebas autorizado.

## C11 — Login Core, perfiles globales y seguridad multiempresa (2026-10-18)
- [x] Login marcado CORE SAAS y punto de entrada unificado `/portal` para perfiles no globales; PETS histórico sigue abriendo su panel.
- [x] Contratos tipados Super-Admin, Super-User, Admin, User; una persona puede tener múltiples membresías en el modelo SQL.
- [x] RPC portal licencias/membresías, provisión y asignación auditada multiempresa diseñadas en `011_core_identity_multitenant.sql`. SQL **NO ejecutado**.
- [x] Vista de soporte de solo lectura con creación/auditoría/cierre por RPC, cookie httpOnly temporal y bloqueo de rutas operativas; **dependiente de SQL 011**.
- [x] Pruebas de roles y permisos negativos por empresa/licencia y bloqueo de soporte.
- [ ] C01 preflight y copia; aplicar 010 y 011 solo tras ensayos en entorno de pruebas.
- [x] Crear usuarios Core y asociar cuentas a varias empresas desde UI, con selector de permisos por vertical, validación SQL y creación auditada (código en PR #7).
- [ ] Desplegar tras preflight 010/011 y pruebas transaccionales/negativas A/B en Supabase; invitaciones aceptadas para correos preexistentes creadas por Admin quedan pendientes.
- [ ] Sustituir filtro PETS basado en `public.usuarios.empresa_id` por membresía elegida validada en todas las APIs y RLS PETS. Hasta entonces NO abrir PETS desde segunda empresa.
- [ ] Activar PULSE frontend y tablas en Core; no presentar PULSE operativo solo por mostrar licencia.
- [ ] Pruebas de aislamiento real: usuario A/B, rol, recurso, URL, API, revocación y soporte. Solo después permitir soporte de lectura real de datos y acciones delegadas aprobadas.

## C12 — Gestión Core de usuarios, roles y permisos (2026-10-18)
- [x] Formularios de Super-Admin, Admin legacy y Admin multiempresa Core, selector de permisos por vertical, listado de membresías.
- [x] Acciones de creación con Supabase Auth, RPC con actor verificado y rollback ante errores; Super-User global y asociación exclusiva de propietario.
- [x] SQL 011: normalizar delimitadores `$$` de funciones y añadir catálogo de permisos/listado de miembros/búsqueda de cuenta existente restringida a propietario.
- [ ] Generación de invitaciones y confirmación de consentimiento para la asociación de cuentas existentes por Admin.
- [ ] Aplicación 010/011 en Supabase de pruebas y prueba de aislamiento real; ninguna migración fue ejecutada desde GitHub.
- [ ] Reescritura de los permisos en cada API/PETS y RLS para segunda empresa; prohibido habilitarlo prematuramente.
- [ ] En modo soporte, lectura de datos por vista contextual requiere otro diseño auditado. Actualmente solo lectura de metadatos de permiso.

- [x] C12: bloquear Server Actions de escritura cuando la cookie de soporte está activa, no solo bloquear navegación en proxy.
- [ ] C12: pruebas de integración de cookies, Server Actions y RPC en un entorno Next.js conectado a Supabase.

## C13 — Primera fase: PETS con contexto de empresa
- [x] Diseñar y versionar SQL 012 para RLS con membresía, permiso y entitlement PETS.
- [x] Crear nuevas vistas PETS read-only por UUID de empresa, RPC server-side y filtros explícitos.
- [x] Añadir feature flag desactivado por defecto y preflight SQL de lectura.
- [ ] Verificar 010/011, respaldar y ensayar migración 012 en Supabase staging con JWT de empresas A/B.
- [ ] Migrar GET legacy, paginación, exportaciones y fichas de mascotas/propietarios.
- [ ] Migrar Server Actions y API de escritura, veterinarios/usuarios y RLS de todas las tablas PETS.
- [ ] Ejecutar E2E de aislamiento con revocación y cambio de empresa, y habilitar producción solo tras aprobarlo.

## C18 — UNI-001: Propuesta de valor y arquitectura multisede unificada
- [x] DEFINIDO: una empresa con N sedes comparte software, login, verticales/complementos, registros maestros e historial; operaciones locales con sede propia.
- [x] DEFINIDO: modelo `core.sedes`, grants de sede por membresía, distinción de maestro vs. evento de sede, búsqueda consolidada y filtros sin duplicados. Documento normativo: `docs/UNIFICACION_MULTISEDE.md`.
- [x] DOCUMENTADO: reglas en AGENTS, modelo de datos, arquitectura, guías de desarrollo, PETS/PULSE, módulos compartidos, frontend, README y bitácora.
- [ ] PRE-FLIGHT: inventariar sedes reales por empresa, valores `fuente` en mascotas/propietarios, consultas asociadas, propietarios/carnets repetidos, SQL 006/009, RLS/FKs y restricciones en staging. No resolver por nombre de sede sin empresa.
- [ ] IMPLEMENTACIÓN DB: diseñar y probar migración SQL de `core.sedes`, identificadores/constraints compuestas y grants de sede. No ejecutar sin respaldo, preflight y pruebas de aislamiento.
- [ ] IMPLEMENTACIÓN PETS: mapear `fuente` heredada sin pérdida de procedencia, retirar SEDE NORTE/SUR rígidas, selector de sede desde Core, búsqueda y ficha unificada, eventos clínicos con sede y pruebas A/B.
- [ ] IMPLEMENTACIÓN MÓDULOS: inventario por ubicación con transferencias auditadas, agenda por sede con choque de horarios, reportes consolidados y filtros, integraciones con origen empresa/sede.
- [ ] IMPLEMENTACIÓN VERTICALES: PETS y PULSE consumen `core.sedes` sin clonar empresas, usuarios, proyectos/boletas o productos por sede; permiso y licencia siempre por empresa.
- [ ] VERIFICACIÓN: pruebas simultáneas A/B de sedes en una empresa, control de usuarios A-only/B-only/A+B, deduplicación y concurrencia, aislamiento entre dos empresas, negativos API/RLS, regresión antes de producción.
**Prioridad:** incorporar a fases C14-C16 sin romper PETS ni confundir esquema de sede con aislamiento multiempresa. Estado actual: diseño/documentación, NO migración aplicada.

## C19 — Paquete Core multisede + alcance módulo INVENTORY
- [x] Diseñar SQL `013_core_sedes.sql` con `core.sedes`, grants de sede, mapeo conservador de `fuente`, FK compuestas y autorización server-side (no aplicado).
- [x] Preparar `supabase/deploy/CORE_UNA_EJECUCION_STAGING.sql`: una transacción para 010–013; preflight estructural y postcheck, bloquea Core parcialmente instalado. NO ejecutado/validado en PostgreSQL.
- [x] Crear rutas nuevas de catálogo/alta de sedes, historial PETS filtrable por sede y exportaciones Excel por empresa autorizada; flag OFF por defecto.
- [x] Planear INVENTORY en `docs/modules/INVENTORY_PLAN.md`: arquitectura, esquema lógico, FEFO/FIFO/JIT, caducidad sin huecos, concurrencia, contratos y fases I0–I9.
- [ ] VALIDAR/INSTALAR 010–013 en Supabase de staging con respaldo y pruebas JWT/RLS empresa A/B, sede A/B.
- [ ] C14: migrar las pantallas y rutas GET/export antiguas a contexto de empresa validado.
- [ ] C15: migrar todas las escrituras PETS, consultas y formularios, control de sede, FKs/autoría y pruebas.
- [ ] C16: retirar dependencia única `public.usuarios.empresa_id` en auth/queries/RPC legacy; estabilizar roles Core multiempresa.
- [ ] INVENTORY I0: acordar semaforización, unidades, proveedores, stock negativo y requisitos regulatorios; el módulo NO se desarrolla aún.
- [ ] Activar producción solo tras E2E y verificación de regresiones. El bundle único STAGING NO equivale al cierre C14/C15/C16.

## 2026-10-19 — Entregables para la rama permanente desarrollo

1. **Licencias Core (código listo, BD pendiente):** instalar SQL 014 después del despliegue de 010–013 y probar propietario global, suspensión, vencimiento y auditoría.
2. **PULSE esquema (DDL listo, BD pendiente):** revisar preflight, ejecutar manualmente SQL 015 sobre Core staging, validar FKs y RLS. No correr sobre la base PULSE actual.
3. **PULSE operativo (pendiente):** adaptar API, pantallas, transacciones y webhooks desde su repositorio original de forma incremental. No ofrecer la vertical hasta completar pruebas.
4. **PETS multiempresa (pendiente):** completar C14–C16 de escrituras y RLS legacy. Estructura TypeScript/core existente no significa migración clínica integral.
5. **Workflow:** único origen `desarrollo`, CI en PR contra `main`, pruebas PowerShell, promoción supervisada y sincronización de la misma rama.


## C20 — PETS: 10 formularios + ampliación INVENTORY (2026-10-19)
- [x] Analizar nueva especificación de 10 formularios/26 páginas referidas y requisitos expresos de Inventario §13; confrontar con INVENTORY_PLAN original I0–I9.
- [x] Plan de ejecución: docs/PLAN_EJECUCION_PETS_INVENTORY_2026_10.md; documentar complementos sin borrar FEFO/FIFO, bodegas, lotes, JIT ni permisos.
- [ ] E0: validar decisiones de taxonomía estándar, SKU, unidad, saldo inicial, eventos de consumo y condiciones «sin inventario».
- [ ] E1: confirmar 013 aplicado en Supabase Core staging y 014 cuando corresponda; cerrar C14–C16 PETS (writes multiempresa y multisede); E2E reales.
- [ ] E2/E3: contratos TS y esquema versionado inventory.* y servicios PETS nuevos; SQL NO aplicado automáticamente.
- [ ] E4/E5/E6: catálogo + modal + cantidades por sede; stock/ledger transaccional; vistas Movimiento/Compras/Ventas.
- [ ] E7/E8: componentes comunes y 10 variantes PETS fieles a la fuente con historial y adjuntos seguros.
- [ ] E9/E10/E11: integración sin descuento implícito; FEFO/FIFO/JIT, validación E2E, piloto y aprobación a main.
**Estado:** plan/documentación; no se han creado tablas, formularios ni descuentos de stock.
