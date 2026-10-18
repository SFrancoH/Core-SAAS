# PLAN DE DESARROLLO — Core SaaS

**Versión inicial:** 0.1 · **Fecha base:** 2026-10-17  
**Proyecto:** Core SaaS multiempresa. **Estrategia:** construir cada vertical por funciones completas, dentro del mismo producto.

## 1. Alcance
Core aporta empresas, cuentas, membresías, permisos, licencias, integraciones y auditoría. PETS, PULSE, AURA, VISION, DRIVE, NEURO y LENS son productos verticales. Inventario, facturación, agenda, documentos y analítica son módulos compartidos opcionales. Un cliente puede tener varias verticales activas.

## 2. Estado inicial
- [x] Código PETS presente en Next.js; `app/`, `components/`, `lib/` y migraciones SQL 001–009.
- [x] Modelo en repositorio de `public.empresas(id uuid)`, `public.usuarios` ligado a `auth.users`, mascotas, propietarios y consultas.
- [ ] Verificación del esquema **real** instalado en el Supabase de Core SaaS.
- [ ] Entitlements, roles/permisos y membresías Core implantados.
- [ ] Primera función PULSE implantada en este repositorio.
- [ ] Módulos compartidos funcionales.
- [ ] Pruebas E2E y publicación consolidada.

## 3. Fases ejecutables

### C00 — Documentación y estructura
- [x] Documentación maestra, modelo de datos, contratos, reglas PETS/PULSE.
- [x] Carpetas previstas sin alterar código de aplicación.
- [ ] Ejecutar build/regresión PETS y registrar resultados en bitácora.
**Criterio:** sin cambios en base de datos ni dependencias; estructura consistente.

### C01 — Inventario de la base Core
- [ ] Consultar en solo lectura columnas, UUID, FKs, RLS, políticas, grants, funciones, triggers, migraciones aplicadas y datos.
- [ ] Definir baseline versionado y copia de seguridad/restauración de prueba.
- [ ] Registrar discrepancias SQL-versión/DB real sin ejecutar correcciones destructivas.
**Criterio:** esquema real comprobado y documentado.

### C02 — Autenticación y contexto empresarial
- [ ] Reutilizar `auth.users`, `public.usuarios` y `public.empresas`.
- [ ] Implementar membresía, empresa activa y separación entre rol de plataforma y rol por empresa.
- [ ] Pruebas de acceso cruzado empresa A/B, cambio de rol y usuario desactivado.
**Criterio:** una sesión no permite leer/editar datos de otra empresa.

### C03 — Licencias y permisos
- [ ] Crear tablas Core de catálogo, permisos, roles, membresías y licencias mediante SQL revisado.
- [ ] Registrar productos y módulos, con PETS como primer producto.
- [ ] Validación de backend y UX para módulos activos/inactivos.
**Criterio:** sin entitlement o permiso, API rechaza la operación.

### C04 — Integraciones estándar
- [ ] Parser común para GHL (raíz, Custom Data, mezcla y alias).
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
- [ ] Auditoría, backups verificados, métricas, colas cuando sean necesarias, CI, permisos y E2E.
- [ ] Definir regulaciones necesarias para clínicas humanas antes de AURA/VISION.
- [ ] Crear próximas verticales solo con requisitos concretos.
**Criterio:** publicación comercial verificada.

## 4. Trabajo por ticket
Leer reglas → identificar vertical/entidad → definir contrato, permisos/licencia y SQL → hacer prueba → implementar una función → validar → registrar archivos/migración/entorno/resultado/commit en bitácora.

**Siguiente trabajo: C01.** No aplicar SQL de PULSE antes de examinar el Supabase de Core SaaS.
