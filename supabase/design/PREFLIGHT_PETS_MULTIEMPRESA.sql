-- PRECHECK C13 PETS MULTIEMPRESA - SOLO LECTURA / NO MODIFICA LA BD.
-- Ejecutar en STAGING antes de 010,011,012 y guardar evidencias.
select current_database(),current_user,now(),version();
select to_regclass('core.accounts') as accounts,
 to_regclass('core.memberships') as memberships,
 to_regclass('core.entitlements') as entitlements,
 to_regprocedure('core.effective_permission(uuid,uuid,text)') as effective_permission,
 to_regprocedure('public.core_pets_tenant_access(uuid,uuid,text)') as tenant_access;
select schemaname,tablename,policyname,cmd,permissive,roles,qual,with_check
from pg_policies where schemaname='public'
and tablename in ('empresas','usuarios','mascotas','propietarios',
 'propietarios_mascotas','consultas_controles','eventos_mascota')
order by tablename,policyname;
select schemaname,tablename,rowsecurity,forcerowsecurity
from pg_tables where schemaname='public' and tablename in
 ('empresas','usuarios','mascotas','propietarios','propietarios_mascotas','consultas_controles','eventos_mascota')
order by tablename;
select 'mascotas' as recurso, empresa_id, count(*) from public.mascotas group by empresa_id
union all select 'propietarios',empresa_id,count(*) from public.propietarios group by empresa_id
union all select 'consultas',empresa_id,count(*) from public.consultas_controles group by empresa_id
order by recurso,empresa_id;
-- Verificar manualmente FKs compuestas, grants, triggers, volumen, backups,
-- esquema real y migrations ejecutadas antes del ensayo de 012.
