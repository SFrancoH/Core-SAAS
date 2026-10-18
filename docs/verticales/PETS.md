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

## Regla obligatoria UNI-001: PETS compartido entre sedes
La mascota, propietario, relaciones e historial longitudinal pertenecen a **una sola empresa**; no se crean fichas independientes para SEDE A y B. Cualquier veterinario con lectura clínica de alcance empresa puede buscar y atender en ambas sedes según sus permisos, sin cambiar de software; debe poder filtrar por sede o consultar el consolidado.

La consulta/control debe registrar `sede_id` de atención, autor, médico y fecha. La ficha de mascota no se reasigna ni se duplica por cambio de sede; cada episodio clínico queda en el historial original. Agenda/servicios/caja/inventario respetan la ubicación física; se puede consultar el conjunto por empresa sin mezclar recursos.

**Brecha PETS actual:** `mascotas.fuente` y `propietarios.fuente` son textos usados como sede, `sedes = ["SEDE NORTE","SEDE SUR"]` está codificado en `pet-catalogs.ts` y SQL 006/009 valida los mismos valores. Ninguna de estas piezas es un catálogo `core.sedes`; al migrarlas mantener procedencia, revisar valores existentes y sustituir referencias rígidas. Un carnet y un documento deben continuar siendo únicos por empresa, no por sede; no duplicar por visita cruzada. **Solo diseño pendiente** hasta migración versionada y pruebas E2E.
