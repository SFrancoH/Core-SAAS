-- Core SaaS 013: sedes de empresa, grants y procedencia PETS.
-- Requiere 010+011+012. NO ejecutada; usar paquete de activacion auditado.
-- INVARIANTE UNI-001: sede NO es tenant; los maestros pertenecen a empresa.
begin;

create schema if not exists core;

create table if not exists core.sedes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete restrict,
  codigo text not null,
  nombre text not null,
  activa boolean not null default true,
  direccion text,
  ciudad text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sedes_codigo_nonblank check (length(btrim(codigo)) between 1 and 50),
  constraint sedes_nombre_nonblank check (length(btrim(nombre)) between 2 and 120),
  unique (empresa_id,id)
);
create unique index if not exists core_sedes_codigo_empresa_uniq
 on core.sedes(empresa_id,lower(btrim(codigo)));
create index if not exists core_sedes_activas_idx on core.sedes(empresa_id,activa);

-- Las membresías históricas de PETS conservan el acceso a TODAS las sedes
-- de su empresa, tal como funcionaba antes; nuevos permisos por sede pueden
-- restringirse explícitamente ('specific'). No crear otro auth.user por sede.
alter table core.memberships
  add column if not exists sede_scope text not null default 'all'
    check (sede_scope in ('all','specific'));
create unique index if not exists core_membership_id_empresa_idx
  on core.memberships(id,empresa_id);

create table if not exists core.membership_sedes (
 membership_id uuid not null,
 empresa_id uuid not null,
 sede_id uuid not null,
 assigned_by uuid references auth.users(id) on delete set null,
 assigned_at timestamptz not null default now(),
 primary key (membership_id,sede_id),
 foreign key (membership_id,empresa_id)
   references core.memberships(id,empresa_id) on delete cascade,
 foreign key (empresa_id,sede_id)
   references core.sedes(empresa_id,id) on delete cascade
);
create index if not exists core_membership_sedes_empresa_idx
 on core.membership_sedes(empresa_id,sede_id);

-- Catalogo legado no es un permiso: preservar 'fuente' sin convertir la
-- sede de origen en el lugar de TODAS las consultas historicas.
create table if not exists core.sede_legacy_mapping (
 empresa_id uuid not null references public.empresas(id) on delete cascade,
 fuente_normalizada text not null,
 sede_id uuid not null,
 mapped_at timestamptz not null default now(),
 primary key(empresa_id,fuente_normalizada),
 foreign key(empresa_id,sede_id) references core.sedes(empresa_id,id)
);
-- Crear SOLO las sedes literales conocidas en PETS y presentes en registros.
-- Si existen textos no reconocidos (origen marketing, errores), NO inventar sedes.
insert into core.sedes(empresa_id,codigo,nombre)
select e.empresa_id,
       case when e.fuente='SEDE NORTE' then 'NORTE' else 'SUR' end,
       e.fuente
from (
 select empresa_id, upper(btrim(fuente)) as fuente from public.mascotas
 union
 select empresa_id, upper(btrim(fuente)) as fuente from public.propietarios
) e
where e.fuente in ('SEDE NORTE','SEDE SUR')
on conflict do nothing;

insert into core.sede_legacy_mapping(empresa_id,fuente_normalizada,sede_id)
select s.empresa_id, s.nombre,s.id from core.sedes s
where s.codigo in ('NORTE','SUR') and s.nombre in ('SEDE NORTE','SEDE SUR')
on conflict do nothing;

-- Datos maestros: sede_origen es metadato informativo; registros continuan
-- unicos por empresa, no por sede. Los NULL de procedencia se conservan.
alter table public.mascotas
 add column if not exists sede_origen_id uuid;
alter table public.propietarios
 add column if not exists sede_origen_id uuid;
alter table public.consultas_controles
 add column if not exists sede_id uuid;
alter table public.eventos_mascota
 add column if not exists sede_id uuid;

update public.mascotas m
set sede_origen_id=map.sede_id
from core.sede_legacy_mapping map
where m.sede_origen_id is null
  and m.empresa_id=map.empresa_id
  and upper(btrim(coalesce(m.fuente,'')))=map.fuente_normalizada;
update public.propietarios p
set sede_origen_id=map.sede_id
from core.sede_legacy_mapping map
where p.sede_origen_id is null
  and p.empresa_id=map.empresa_id
  and upper(btrim(coalesce(p.fuente,'')))=map.fuente_normalizada;

-- No asignar sede a consultas antiguas: ese hecho no se deduce de la sede
-- de alta de la mascota. Las consultas NUEVAS exigirán sede cuando el flujo
-- multi-sede pase a producción tras migrar todas las Server Actions.

do $$
begin
 if not exists(select 1 from pg_constraint
   where conname='mascotas_sede_origen_misma_empresa'
   and conrelid='public.mascotas'::regclass) then
  alter table public.mascotas
   add constraint mascotas_sede_origen_misma_empresa
   foreign key (empresa_id,sede_origen_id)
   references core.sedes(empresa_id,id) not valid;
 end if;
 if not exists(select 1 from pg_constraint
   where conname='propietarios_sede_origen_misma_empresa'
   and conrelid='public.propietarios'::regclass) then
  alter table public.propietarios
   add constraint propietarios_sede_origen_misma_empresa
   foreign key (empresa_id,sede_origen_id)
   references core.sedes(empresa_id,id) not valid;
 end if;
 if not exists(select 1 from pg_constraint
   where conname='consultas_sede_misma_empresa'
   and conrelid='public.consultas_controles'::regclass) then
  alter table public.consultas_controles
   add constraint consultas_sede_misma_empresa
   foreign key (empresa_id,sede_id)
   references core.sedes(empresa_id,id) not valid;
 end if;
 if not exists(select 1 from pg_constraint
   where conname='eventos_sede_misma_empresa'
   and conrelid='public.eventos_mascota'::regclass) then
  alter table public.eventos_mascota
   add constraint eventos_sede_misma_empresa
   foreign key (empresa_id,sede_id)
   references core.sedes(empresa_id,id) not valid;
 end if;
end $$;

create index if not exists pets_consultas_sede_idx
 on public.consultas_controles(empresa_id,sede_id,fecha_registro desc);
create index if not exists pets_eventos_sede_idx
 on public.eventos_mascota(empresa_id,sede_id,fecha_registro desc);

-- RLS cerrada para tablas CORE: solo APIs server-side autorizadas.
alter table core.sedes enable row level security;
alter table core.membership_sedes enable row level security;
alter table core.sede_legacy_mapping enable row level security;
revoke all on core.sedes,core.membership_sedes,core.sede_legacy_mapping
 from public,anon,authenticated;
grant select,insert,update,delete on core.sedes,core.membership_sedes,
 core.sede_legacy_mapping to service_role;

-- Super-Admin global puede operar en sedes (sujeto al permiso vertical).
-- El super-user solo actúa con grants por empresa explícitos y el control
-- de sede queda en 'all' hasta que se introduzcan permisos de sede staff.
create or replace function core.site_allowed(
 p_actor uuid,p_empresa uuid,p_sede uuid,p_permission text
) returns boolean language sql stable security definer set search_path=''
as $$
select coalesce(
 p_sede is not null
 and core.effective_permission(p_actor,p_empresa,p_permission)
 and exists(
  select 1 from core.sedes s where s.empresa_id=p_empresa
  and s.id=p_sede and s.activa
 )
 and (
  exists(
   select 1 from core.platform_staff st join core.accounts a
    on a.user_id=st.user_id and a.active
   where st.user_id=p_actor and st.role='super_admin' and st.active
  )
  or exists (
    select 1 from core.memberships m
    where m.user_id=p_actor and m.empresa_id=p_empresa
      and m.status='active'
      and (m.sede_scope='all' or exists(
       select 1 from core.membership_sedes ms
       where ms.membership_id=m.id and ms.empresa_id=p_empresa
         and ms.sede_id=p_sede))
  )
  or exists (
   select 1 from core.platform_permission_grants gp
    join core.platform_staff st on st.user_id=gp.staff_user_id and st.active
   where gp.staff_user_id=p_actor and st.role='super_user'
     and gp.empresa_id=p_empresa and gp.permission_code=p_permission
  )
 )
,false);
$$;
revoke all on function core.site_allowed(uuid,uuid,uuid,text)
 from public,anon,authenticated;
grant execute on function core.site_allowed(uuid,uuid,uuid,text) to service_role;

create or replace function public.core_sedes_access(
 p_actor_id uuid,p_empresa_id uuid,p_permiso text
) returns jsonb language sql stable security definer set search_path=''
as $$
select coalesce(jsonb_agg(jsonb_build_object(
 'id',s.id,'nombre',s.nombre,'codigo',s.codigo
 ) order by s.nombre),'[]'::jsonb)
from core.sedes s
where s.empresa_id=p_empresa_id
 and s.activa
 and core.site_allowed(p_actor_id,p_empresa_id,s.id,p_permiso);
$$;
revoke all on function public.core_sedes_access(uuid,uuid,text)
 from public,anon,authenticated;
grant execute on function public.core_sedes_access(uuid,uuid,text) to service_role;

-- Auditoría de mapeos importados debe revisarse ANTES de habilitar el UI.
-- Entidades maestros conservarán fuente legacy y carnet/documento UNIQUE por EMPRESA.
commit;
