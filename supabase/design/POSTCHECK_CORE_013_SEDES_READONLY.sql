-- Core SaaS 013 — postcheck de solo lectura.
-- Ejecutar MANUALMENTE en el SQL Editor del proyecto de Supabase donde se instaló 013.
-- NO crea, altera ni elimina tablas/filas; NO sustituye tests JWT/RLS de dos empresas.
-- Mantener los resultados privados (pueden contener UUID de empresas o sedes).

-- 1. Tablas y funciones exigidas por 013. "false" requiere investigación.
select 'table:core.sedes' as objeto, to_regclass('core.sedes') is not null as existe
union all select 'table:core.membership_sedes',to_regclass('core.membership_sedes') is not null
union all select 'table:core.sede_legacy_mapping',to_regclass('core.sede_legacy_mapping') is not null
union all select 'function:core.site_allowed',to_regprocedure('core.site_allowed(uuid,uuid,uuid,text)') is not null
union all select 'function:public.core_sedes_access',to_regprocedure('public.core_sedes_access(uuid,uuid,text)') is not null
union all select 'function:public.core_crear_sede',to_regprocedure('public.core_crear_sede(uuid,uuid,text,text)') is not null
union all select 'function:public.core_contexto_sedes',to_regprocedure('public.core_contexto_sedes(uuid,uuid,text)') is not null
order by objeto;

-- 2. Columnas previstas (se enumeran las presentes, contrastar con listado esperado).
select table_schema,table_name,column_name,data_type
from information_schema.columns
where (table_schema='core' and table_name='memberships' and column_name='sede_scope')
 or (table_schema='public' and table_name='mascotas' and column_name='sede_origen_id')
 or (table_schema='public' and table_name='propietarios' and column_name='sede_origen_id')
 or (table_schema='public' and table_name='consultas_controles' and column_name='sede_id')
 or (table_schema='public' and table_name='eventos_mascota' and column_name='sede_id')
order by table_schema,table_name,column_name;

-- 3. Las tres tablas de sedes Core deben tener RLS activado.
select schemaname,tablename,rowsecurity
from pg_tables
where schemaname='core'
 and tablename in ('sedes','membership_sedes','sede_legacy_mapping')
order by tablename;

-- 4. FKs de empresa/sede: 013 instala algunas como NOT VALID por protección histórica.
-- NOT VALID no significa que la migración fallara; se validan aparte tras revisar legados.
select n.nspname as esquema,c.relname as tabla,ct.conname as nombre_constraint,
       ct.contype as tipo,ct.convalidated as validada
from pg_constraint ct
join pg_class c on c.oid=ct.conrelid
join pg_namespace n on n.oid=c.relnamespace
where (n.nspname='core' and c.relname in ('sedes','membership_sedes','sede_legacy_mapping'))
   or (n.nspname='public' and ct.conname in
    ('mascotas_sede_origen_misma_empresa','propietarios_sede_origen_misma_empresa',
     'consultas_sede_misma_empresa','eventos_sede_misma_empresa'))
order by esquema,tabla,nombre_constraint;

-- 5. Resumen no sensible del catálogo. Cero sedes puede ser válido en empresa nueva.
select empresa_id,count(*)::integer as sedes_total,
       count(*) filter (where activa)::integer as sedes_activas
from core.sedes group by empresa_id order by empresa_id;

-- 6. Verificar datos heredados incongruentes sin corregirlos.
-- Se espera que todas estas cuentas devuelvan cero.
select 'mascotas' as origen,count(*)::bigint as relaciones_invalidas
from public.mascotas m
left join core.sedes s on s.id=m.sede_origen_id and s.empresa_id=m.empresa_id
where m.sede_origen_id is not null and s.id is null
union all
select 'propietarios',count(*)::bigint
from public.propietarios p
left join core.sedes s on s.id=p.sede_origen_id and s.empresa_id=p.empresa_id
where p.sede_origen_id is not null and s.id is null
union all
select 'consultas_controles',count(*)::bigint
from public.consultas_controles c
left join core.sedes s on s.id=c.sede_id and s.empresa_id=c.empresa_id
where c.sede_id is not null and s.id is null
union all
select 'eventos_mascota',count(*)::bigint
from public.eventos_mascota e
left join core.sedes s on s.id=e.sede_id and s.empresa_id=e.empresa_id
where e.sede_id is not null and s.id is null;

-- 7. Asociaciones de usuarios a sedes de otra empresa (debe ser cero).
select count(*)::bigint as membership_sedes_invalidas
from core.membership_sedes ms
left join core.memberships m on m.id=ms.membership_id and m.empresa_id=ms.empresa_id
left join core.sedes s on s.id=ms.sede_id and s.empresa_id=ms.empresa_id
where m.id is null or s.id is null;

-- 8. Determinar SI 014 está aplicada sin escribir (no ejecutar 014 a ciegas).
select 'core_company_entitlements' as funcion,
       to_regprocedure('public.core_company_entitlements(uuid,uuid)') is not null as existe
union all
select 'core_set_product_entitlement',
       to_regprocedure('public.core_set_product_entitlement(uuid,uuid,text,text,timestamptz)') is not null;

-- 9. NO UTILIZAR ESTE SCRIPT para declarar aislamiento verificado.
-- Deben probarse JWT Supabase auth de empresa A, empresa B, A-only, A+B,
-- sedes A-only/B-only, revocación, acciones legacy y RLS en entorno seguro.
