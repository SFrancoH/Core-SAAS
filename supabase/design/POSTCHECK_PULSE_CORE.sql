-- SOLO LECTURA: ejecutar tras aplicar 015 en Core STAGING.
select table_schema,table_name
from information_schema.tables
where table_schema='pulse' and table_type='BASE TABLE'
order by table_name;
select schemaname,tablename,rowsecurity
from pg_tables where schemaname='pulse' order by tablename;
select table_name,privilege_type,grantee
from information_schema.role_table_grants
where table_schema='pulse' and grantee in ('anon','authenticated','service_role')
order by table_name,grantee,privilege_type;
select conrelid::regclass as tabla,conname,contype
from pg_constraint where connamespace='pulse'::regnamespace order by conrelid::regclass::text,conname;
select count(*) as pulse_proyectos from pulse.proyectos;
select count(*) as pulse_boletas from pulse.boletas;
-- Pruebas manuales posteriores: UUID cruzado A/B y proyectos distintos con
-- mismo número 0001; licencia PULSE suspendida; operación solo con service_role
-- tras la RPC protegida. La ausencia de grants no prueba por sí sola reglas de API.
