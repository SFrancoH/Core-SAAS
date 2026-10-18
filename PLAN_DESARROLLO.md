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
