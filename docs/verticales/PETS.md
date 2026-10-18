# Vertical PETS — Core SaaS

**Sector:** clínicas veterinarias. **Estado:** aplicación PETS presente en código; reglas de licenciamiento Core aún por implantar.

## Datos y procesos
`public.mascotas`, `public.propietarios`, `public.propietarios_mascotas`, `public.consultas_controles` y `public.eventos_mascota`. Todos los registros operativos tienen `empresa_id uuid`. Propietarios y mascotas mantienen relación muchos-a-muchos. PETS es fuente de verdad de datos clínicos; los formularios nativos escriben mediante servidor, sin formularios externos/precarga de datos personales en URLs.

## Reglas innegociables
- Servidor valida sesión, empresa, permiso y licencia en cada operación; nunca atribuir autorización a campo enviado en cliente.
- Consulta/control conserva autor, médico responsable, fecha del servidor, mascota y empresa. Historial de procedimientos, diagnósticos y tratamientos auditable.
- La caída del CRM no revierte una consulta confirmada. Sincronización por API/webhook autenticado y reintentos idempotentes para eventos permitidos.
- Adjuntos clínicos privados en Storage con control de acceso; no binarios dentro de JSON/texto ni URLs públicas permanentes.
- Carnet de 14 dígitos `ddmmaaaaHHMMSS` en hora Bogotá; exigir unicidad por empresa y manejar colisiones.
- «Agregar otro propietario» busca coincidencia por documento/teléfono normalizado dentro de empresa; asociar si existe, no duplicar.
- Los módulos agenda, inventario y facturación se consumen mediante interfaces compartidas.

**Implementación:** migraciones PETS 001–009 están versionadas; su ejecución real debe validarse. Mantener rutas existentes hasta ir incorporándolas a casos de uso Core, sin reorganización masiva.
