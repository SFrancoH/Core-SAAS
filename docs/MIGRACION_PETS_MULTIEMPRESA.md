# C13 — PETS multiempresa: fase 1 (lectura)

**Estado:** migración SQL versionada + código del PR #8. Ningún SQL aplicado. PULSE sin cambios.

## Contexto de autorización
Una persona usa la identidad Supabase Auth global. El UUID de la empresa viene de la ruta de su espacio de trabajo, pero **no concede acceso por sí mismo**. El servidor obtiene el actor mediante getCurrentProfile() y llama a la RPC public.core_pets_tenant_access(actor, empresa, permiso) usando service_role exclusivamente en servidor. La RPC exige cuenta, empresa, licencia PETS y permisos vigentes.
Las rutas con service_role aplican siempre filtro empresa_id y verifican los IDs de las filas recibidas (ensureTenantRows). De esta manera, incluso si alguien cambia la URL por otra empresa, el backend debe negar antes de consultar y no permitir resultados mezclados.

## Rutas implementadas (solo lectura)
- /portal/empresa/[id]/pets/mascotas — listado paginado, búsqueda y filtro por empresa.
- /portal/empresa/[id]/pets/mascotas/[petId] — ficha básica; valida empresa y recurso.
- /portal/empresa/[id]/pets/propietarios — listado paginado de propietarios de esa empresa.
El portal muestra acceso nuevo únicamente con CORE_PETS_MULTI_TENANT_READ_ENABLED=true, desactivado por defecto. Las rutas antiguas de PETS y todas las escrituras clínicas conservan su comportamiento legacy en esta fase; no deben seleccionarse segundas empresas desde ellas.

## Migración 012 (NO ejecutar aún)
Requiere 010 y 011 aplicadas y verificadas. Implementa private.pets_tenant_allowed: auth.uid() + empresa activa + entitlement PETS activo + core.effective_permission para el permiso específico. Reemplaza políticas permisivas históricas de mascotas, propietarios, asociaciones, consultas e historial dentro de una transacción. Detiene instalación ante otras políticas PETS no esperadas para evitar unión OR permisiva.
Agrega RPC service_role public.core_pets_tenant_access para nuevas rutas, y una política SELECT de empresas en caso de membresía PETS autorizada. No actualiza public.usuarios, credenciales, ni los datos de PULSE.

## Ejecución segura: requisitos obligatorios
1. Identificar la instancia Core correcta. Ejecutar como solo lectura los preflights PREFLIGHT_CORE.sql y PREFLIGHT_PETS_MULTIEMPRESA.sql. Guardar la salida y confirmar tablas, índices, constraints, permisos, RLS, triggers y migraciones existentes.
2. Preparar backup y probar restauración, más un staging con datos de prueba o copia anonimizada.
3. Instalar y verificar 010 y 011 en orden en staging (si faltan). Comprobar migración de membresías, roles, permisos, entitlements y funciones; NO aplicar 012 si la precarga no coincide.
4. Instalar 012 en staging; ejecutar tests E2E reales con al menos empresas A y B, un User solo A, otro A+B, un Admin, el propietario y un User sin permisos.
5. Negativas obligatorias: cambiar companyId, petId o URL no permite leer B; revocar membresía elimina acceso inmediatamente; suspender licencia bloquea vistas; un usuario sin pets.pet.read no ve animales; JWT autenticado prueba RLS sobre Supabase REST (no solo service_role, que omite RLS).
6. Probar versiones actuales de PETS tras 012, incluidas exportaciones, importaciones, consultas, procedimientos, veterinarios y propietarios. En caso de fallo de regresión, NO publicar.
7. Activar flag únicamente en staging después de validar. Producción exige aprobación y plan de rollback aparte.

## Próximas fases
- C14: mover listados y detalles legacy GET a contexto por empresa (incluye exports) sin romper URLs/enlaces.
- C15: mover acciones de escritura, integraciones y procedimientos clínicos a autorización de tenant explícita, con transacciones y auditoría.
- C16: migrar dependencia de public.usuarios.empresa_id, perfil de veterinario y foreign keys históricas; retirar lógica de un tenant único.
- C17: validar soporte contextual y permisos efectivos sin sustituir credenciales Auth ajenas.

## Riesgos
- service_role evita RLS; es imperativo usar RPC + filtro explícito en cada consulta y comprobar que las filas tienen el mismo empresa_id.
- Políticas RLS PostgreSQL permisivas se combinan con OR. No agregar permisos nuevos sin eliminar las políticas históricas de alcance inseguro.
- Un build de TypeScript y pruebas puras no demuestran autorización real en PostgreSQL.
- Las cuentas Core nuevas no tienen necesariamente perfil public.usuarios, y algunas FKs clínicas todavía lo requieren.
## Actualización C19
La migración 013 añade sedes Core, mapeo conservador PETS y RPC de acceso por sede. `supabase/deploy/CORE_UNA_EJECUCION_STAGING.sql` agrupa 010–013 en una transacción **para una instalación inicial en staging** y falla si hay Core previo/parcial. No se ejecutó ni verificó en DB real; ver `docs/DESPLIEGUE_UNICO_CORE_STAGING.md`. Se añadieron vistas de historial por sede y exportación por tenant; C14 legacy y escrituras C15/C16 permanecen pendientes, sin bandera activada.
