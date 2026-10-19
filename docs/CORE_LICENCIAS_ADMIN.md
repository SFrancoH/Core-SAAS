# Licencias por empresa: pantalla Core Admin

**Código preparado; SQL no ejecutado.** Se requiere Core 010, 011 y después 014.
El propietario global administra licencias desde `/super-admin/empresas/[id]/licencias`.

- La cuenta Core debe ser el único `super_admin` activo. La identidad siempre proviene de Supabase Auth verificado por el servidor.
- `core_company_entitlements`: muestra catálogo y licencias de una empresa al propietario, mediante RPC service_role.
- `core_set_product_entitlement`: activa/suspende o renueva una licencia de producto. Cambia solo esa empresa/producto y escribe auditoría.
- El estado efectivo depende de `status='active'`, `valid_from` y `valid_until`. Tener licencia no confiere permisos ni acceso a datos de otra empresa.
- La fecha seleccionada vence a las 23:59:59.999 UTC del día elegido.
- PULSE está registrado en el catálogo, pero no se habilita por defecto; solo el propietario puede activarlo manualmente.

**Límites**: licencias de módulos, planes, facturación recurrente, cobros y controles de cuota siguen pendientes; esta pantalla gestiona entitlements de producto, no cobros. La base de datos real y RLS requieren pruebas con JWT en staging. No usar `service_role` desde el navegador.

**Prueba manual mínima**: crear empresa A/B; instalar SQL; activar PETS solo en A y PULSE solo en B; probar rechazo A→B, usuario sin permisos, suspensión y vencimiento; revisar `core.audit_events`.