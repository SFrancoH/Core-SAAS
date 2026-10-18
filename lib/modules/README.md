# Módulos compartidos
Inventario, facturación, agenda y complementos futuros vivirán aquí como interfaces y casos de uso TypeScript. Son transversales y no importan detalles internos de PETS/PULSE. No hay módulos de negocio implementados aún.

## Regla universal UNI-001 — Complementos multisede
Inventario, agenda, facturación, caja, reportes e integraciones reutilizan `public.empresas`, permisos, licencias y sedes Core; no se duplica cada complemento por cada sucursal ni se obliga al cliente a abrir otro sistema.
- **Catálogos/maestros únicos por empresa** (SKU, servicios, clientes y proveedores cuando corresponda).
- **Operación localizada cuando aplica**: stock y almacenes por sede; agenda por sede/profesional/recurso; caja/turno por punto de operación; documentos con origen y requisitos fiscales correspondientes.
- **Lectura consolidada** con filtros de sede y permisos; **escritura local** requiere sede concreta autorizada; traslados de stock requieren movimientos auditables y balanceados.
- Probar dos sedes de una empresa, permisos por sede, concurrencia/deduplicación y no acceso entre empresas.
Regla completa en `docs/UNIFICACION_MULTISEDE.md`. **Diseño; los complementos de negocio aún no están implementados.**
