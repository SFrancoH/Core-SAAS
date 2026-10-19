# PULSE dentro de Core — DDL 015 y despliegue manual

**Estado:** estructura versionada para Core, no aplicada a ninguna base de datos. **No sustituye el backend actual de PULSE** y no importa datos automáticamente. El repositorio `SFrancoH/pulse` y su Supabase original permanecen intactos.

## Orden de aplicación en Supabase Core de pruebas

1. Respaldar Core y verificar el esquema real de `public.empresas` y `auth.users`.
2. Si todavía no está Core 010–013, instalar **una única vez** `supabase/deploy/CORE_UNA_EJECUCION_STAGING.sql` siguiendo `docs/DESPLIEGUE_UNICO_CORE_STAGING.md`. Si ya están, **no repetir** el bundle.
3. Ejecutar manualmente `supabase/migrations/014_core_license_admin.sql` para el administrador de licencias.
4. Ejecutar `supabase/design/PREFLIGHT_PULSE_CORE.sql`; detenerse si las tablas `pulse.*` ya existen, los IDs no son UUID o faltan entidades Core.
5. Ejecutar manualmente `supabase/migrations/015_pulse_core_schema.sql` **solo en Core staging**.
6. Ejecutar `supabase/design/POSTCHECK_PULSE_CORE.sql`; probar JWT/tenant A-B, estados, pago y RLS. No interpretar un postcheck estático como prueba funcional de la UI.
7. Después de probar y aprobar, repetir el despliegue verificado en Core de producción (si es otra instancia). Nunca ejecutar en la base original de PULSE.

## Tablas

| Tabla en `pulse` | Finalidad |
|---|---|
| `proyectos` | Campañas, landing, sorteos y enlace comercial (hash) |
| `boletas` | 4 dígitos exactos, cliente, estado, pago, vendedor |
| `reservas` | Grupo/hold temporal y confirmación |
| `asignaciones_vendedores` | Historial de asignaciones con sede compartida |
| `seller_sales_links` | Links revocables y hash del secreto |
| `ganadores` | Ganadores ordenables con video y flyer |
| `movimientos_pago` | Ledger auditable, saldo acumulado |
| `eventos_reserva` | Intento único de webhook de Oficina |
| `alertas_oportunidades` | Pendientes manuales por boleta y reserva |

**Aislamiento:** `empresa_id uuid` referencia `public.empresas`; `proyecto_id uuid` referencia `pulse.proyectos`, con FK compuestas que evitan cruces entre tenants. Sedes usan `core.sedes`, vendedores usan `core.memberships`. RLS activada sin permisos directos para `anon`/`authenticated`; `service_role` solo puede usarla backend autorizado.

**Compatibilidad con PULSE antiguo:** `public.proyectos.id` y `empresa_id` originales son `text`; `pulse.proyectos.legacy_project_id` es opcional para futuro mapeo, **no copiar text a PK UUID**. Vendedores antiguos en `public.admin_users` necesitarán correspondencia con `auth.users` y membresías Core. Links antiguos con tokens sin hash requieren regeneración/rotación; no usar token legado sin protección.

**Estados:** `Disponible`, `No disponible`, `Debe`, `Abonado`, `Pagado`. `pagado_en` se fija por trigger de base cuando cambia a `Pagado`; no depende del dato webhook. Una boleta abonada o pagada no puede liberarse silenciosamente a `Disponible`.

**Pendiente de implementación (NO incluido por crear tablas):** UI PULSE, endpoints de venta, reglas de reserva atómica/lotes, reconciliación de saldo con ledger, importación histórica, funciones de elección aleatoria e integración externa. Deben agregarse como código TypeScript aislado y pruebas, sin copiar a ciegas el backend de PULSE antiguo. **No activar licencia de PULSE a clientes operativos hasta implementar y verificar esos servicios.**
