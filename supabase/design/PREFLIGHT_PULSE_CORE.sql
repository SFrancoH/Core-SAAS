-- SOLO LECTURA: ejecutar antes de 015 (en Supabase Core de PRUEBAS).
-- "OK" en Core no significa que PULSE original deba tocarse.
select to_regclass('public.empresas') as empresas_core,
       to_regclass('core.memberships') as membresias_core,
       to_regclass('core.entitlements') as licencias_core,
       to_regclass('core.sedes') as sedes_core,
       to_regclass('pulse.proyectos') as pulse_ya_existente;
select table_schema,table_name
from information_schema.tables
where table_schema in ('core','pulse') and table_type='BASE TABLE'
order by table_schema,table_name;
select code,active from core.products where code in ('PETS','PULSE');
select count(*) as empresas_core from public.empresas;
-- Si pulse.proyectos no es NULL, detenerse y comparar esquema real; nunca sobreescribir.
