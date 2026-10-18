-- Solo lectura: revisar la instancia Supabase reservada para Core SaaS.
-- Ejecutar y conservar resultado ANTES de aplicar 010_core_access.sql.
select current_database() as database_name, current_schema() as current_schema_name,
       current_user as sql_actor, now() as checked_at;
select table_schema,table_name
from information_schema.tables
where (table_schema in ('public','core','pulse') and table_type='BASE TABLE')
order by table_schema,table_name;
select table_schema,table_name,column_name,data_type,udt_name,is_nullable
from information_schema.columns
where table_schema='public' and table_name in ('empresas','usuarios','mascotas',
 'propietarios','propietarios_mascotas','consultas_controles','eventos_mascota')
order by table_name,ordinal_position;
select schemaname,tablename,rowsecurity
from pg_tables where schemaname in ('public','core','pulse')
order by schemaname,tablename;
select n.nspname as schema_name, p.proname as function_name
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','core') and p.proname like '%core%'
order by 1,2;
-- Verificar adicionalmente estado de migraciones, triggers, grants, volumen y copia
-- de seguridad con el panel de Supabase; esta consulta no demuestra restaurabilidad.
