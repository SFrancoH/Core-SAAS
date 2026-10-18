# CORE — Preparación de despliegue multiempresa/multisede

**Estado técnico (2026-10-18):** SQL 010–013 empaquetado en **una sola transacción manual** para **instalación inicial en STAGING**, sin conexión al PostgreSQL real y sin E2E RLS ejecutados. **NO CONSIDERAR LISTO PARA PRODUCCIÓN** ni ejecutar a ciegas.

## ¿Qué significa «una sola ejecución manual de Supabase»?

El archivo \`supabase/deploy/CORE_UNA_EJECUCION_STAGING.sql\` contiene, en orden, las migraciones 010, 011, 012 y 013 **integradas en una única transacción BEGIN ... COMMIT**. Si falla una sentencia, se revierte todo. Incluye comprobaciones previas de tablas/RPC históricas y posteriores de estructuras/membresías y sedes. No contiene Inventario (ese complemento solamente está documentado).

**Límite deliberado:** la ejecución es válida únicamente si las migraciones Core 010/011/012/013 **aún no se han ejecutado** y existe un esquema PETS compatible con 001–009. Si detecta Core parcialmente instalado, falla en vez de volver a crear/reparar esquemas arbitrariamente. Se necesita inspeccionar y decidir cómo reconciliarlo; **no se deben borrar tablas para forzar la ejecución**.

## Procedimiento manual en Supabase cuando esté validado

1. Verificar que el dashboard abierto corresponda a la instancia de **pruebas de PETS/Core**, nunca a PULSE/productivo. Contar con un backup restaurable y confirmar el esquema actual/policies/roles con \`supabase/design/PREFLIGHT_CORE.sql\` y \`supabase/design/PREFLIGHT_PETS_MULTIEMPRESA.sql\` (lectura, antes de habilitar).
2. Contrastar el preflight con los SQL 001–009 y las políticas reales. Comprobar especialmente \`public.usuarios\` (UUID), \`fuente\` y las funciones de registro. Si existen las tablas \`core.memberships\` o \`core.accounts\`, **no usar el bundle**: requiere un plan de migraciones parciales.
3. Pegar el **contenido completo** de \`supabase/deploy/CORE_UNA_EJECUCION_STAGING.sql\` en Supabase SQL Editor de STAGING y ejecutar **una vez**. No ejecutar 010–013 por separado y después repetir el bundle.
4. Confirmar finalización con \`COMMIT\`, aviso postcheck y presencia de fila \`CORE_010_013\` en \`core.migration_bundle_runs\`. Si SQL Editor devuelve error, abortó la transacción; no reintentar ciegamente.
5. Ejecutar **pruebas JWT reales**: miembro de A consulta A, nunca B; miembro A+B cambia contexto sin mezclar; usuario A-only no obtiene operaciones de sede B; revocar membresía/licencia y comprobar fallo; usuario sin permiso denegado; relaciones mascota/propietario sin cross-tenant. Probar como rol \`authenticated\`, no como \`postgres\` o \`service_role\` que puede saltarse RLS.
6. Revisar sedes importadas: solo se crean etiquetas reconocidas **SEDE NORTE/SUR que existen en registros**. \`fuente\` desconocida permanece como texto, \`sede_origen_id\` nulo; \`consultas_controles.sede_id\` histórico queda **nulo**, porque nunca se debe inferir la sede de atención desde la sede de alta.
7. Revisar regresión del PETS antiguo. La versión nueva usa \`CORE_PETS_MULTI_TENANT_READ_ENABLED=true\` solamente cuando todo fue probado. Por defecto la bandera es **false**: abrir una pantalla antigua no concede multiempresa. Cambios en Vercel y producción son pasos distintos, sujetos a aprobación.

## Estado de fases de desarrollo

| Fase | Implementado en código | Por hacer antes de cierre |
|---|---|---|
| Core 010–013 | Migraciones versionadas, bundle staging y tests estáticos | Inspección de esquema real, migraciones en staging, pruebas PostgreSQL/RLS con JWT |
| C13 multisede | Tablas sedes, grants, mapeo conservador, RPC de creación/lista/auditoría | Verificar FKs, permisos, backfill y reglas de sede en DB |
| C14 lecturas | Portal multiempresa inicial, listados PETS, ficha básica, historial por sede y exports nuevos por empresa | **Migrar vistas antiguas GET y sus enlaces**, exportaciones antiguas y búsqueda integral; E2E |
| C15 escrituras | **No migradas** las acciones clínicas de legacy | Crear/adaptar consultas, altas, propietarios, importaciones y movimientos con contexto empresa+sede, transacciones, FKs y permisos |
| C16 usuarios legacy | Cuenta Core/membresía preparados, permisos de empresa y RLS 012 | Retirar dependencias \`public.usuarios.empresa_id\` y FKs de autoría legacy, migrar contratos de veterinarios y todos los endpoints |
| Inventory | Plan funcional/técnico en \`docs/modules/INVENTORY_PLAN.md\` | Acordar I0, después desarrollar I1–I9 en PRs; no incluye SQL de inventario |

Por tanto, **no es correcto afirmar que sólo falta ejecutar Supabase en producción**: el paquete permite una ejecución manual de la base **para la fase inicial en staging**, pero C14–C16 restantes requieren desarrollo adicional y pruebas de aislamiento. Los cambios aquí son acumulativos y preservan comportamiento productivo.

## Qué no se debe hacer

- No pegar \`010\`, \`011\`, \`012\` y \`013\` sucesivamente en el editor si se va a usar el bundle.
- No ejecutar el bundle en la base productiva ni en una base Core parcialmente migrada.
- No habilitar el feature flag antes de validar memberships/licencias/RLS A/B y datos de sede.
- No duplicar mascotas/propietarios por sede, no mover consultas históricas a una sede sin evidencia y no borrar \`fuente\` antes de conciliar.
- No dar por terminada C15/C16 solo por pasar TypeScript o contar con funciones SQL de lectura.
