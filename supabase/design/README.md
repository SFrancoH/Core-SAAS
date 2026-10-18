# Diseño de base de datos
Preflight de solo lectura, esquemas propuestos y diccionario de datos. Esta carpeta no ejecuta SQL. Las migraciones aprobadas se almacenan en `supabase/migrations` tras revisar la BD real.

## Diseño pendiente de sedes Core — UNI-001
No aplicar SQL inventado para nuevas sedes antes de inventariar la base real. La arquitectura propone `core.sedes` y grants por membresía, con FKs compuestas `(empresa_id,sede_id)`, permisos/RLS en empresa y sede, y procedencia de registros de eventos. PETS utiliza `fuente` texto en mascotas/propietarios y valores rígidos de SEDE NORTE/SUR en SQL 006/009. Requerido: preflight, mapeo por empresa, claves únicas de maestros, respaldo, pruebas A/B de sedes y de empresas, migración versionada reversible donde sea posible.
Ver `docs/UNIFICACION_MULTISEDE.md` y fase C18 de `PLAN_DESARROLLO.md`.
