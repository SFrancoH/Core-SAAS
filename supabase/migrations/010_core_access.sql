-- Core SaaS 010: catálogo de productos, membresías, roles y licencias.
-- Diseñada a partir de public.empresas (uuid) y public.usuarios / auth.users (migración 001).
-- NO ejecutar hasta comparar esquema real, probar en entorno no productivo y respaldar.
-- No altera ni elimina registros PETS; crea esquema propio y sincroniza membresías.
begin;

create extension if not exists pgcrypto;
create schema if not exists core;
revoke all on schema core from public, anon, authenticated;
grant usage on schema core to service_role;

create table if not exists core.products (
  code text primary key,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists core.modules (
  code text primary key,
  name text not null,
  kind text not null check (kind in ('shared','vertical')),
  active boolean not null default true
);

create table if not exists core.product_modules (
  product_code text not null references core.products(code) on delete cascade,
  module_code text not null references core.modules(code) on delete restrict,
  required boolean not null default false,
  primary key (product_code, module_code)
);

create table if not exists core.roles (
  code text primary key,
  scope text not null default 'company' check (scope in ('company','platform')),
  name text not null
);
create table if not exists core.permissions (
  code text primary key,
  name text not null,
  product_code text references core.products(code),
  module_code text references core.modules(code),
  constraint permission_product_or_module check (product_code is null or module_code is null)
);
create table if not exists core.role_permissions (
  role_code text not null references core.roles(code) on delete cascade,
  permission_code text not null references core.permissions(code) on delete cascade,
  primary key (role_code, permission_code)
);

create table if not exists core.memberships (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, user_id)
);
create index if not exists core_memberships_user_idx on core.memberships(user_id, status);

create table if not exists core.membership_roles (
  membership_id uuid not null references core.memberships(id) on delete cascade,
  role_code text not null references core.roles(code) on delete cascade,
  primary key (membership_id, role_code)
);

create table if not exists core.entitlements (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  product_code text references core.products(code) on delete restrict,
  module_code text references core.modules(code) on delete restrict,
  status text not null default 'active' check (status in ('active','suspended','expired')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  limits jsonb not null default '{}'::jsonb check (jsonb_typeof(limits)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint core_entitlement_exactly_one check (
    (product_code is not null and module_code is null)
    or (product_code is null and module_code is not null)
  ),
  constraint core_entitlement_dates check (valid_until is null or valid_until > valid_from)
);
create unique index if not exists core_entitlement_product_unique
  on core.entitlements(empresa_id, product_code) where product_code is not null;
create unique index if not exists core_entitlement_module_unique
  on core.entitlements(empresa_id, module_code) where module_code is not null;
create index if not exists core_entitlement_company_active_idx
  on core.entitlements(empresa_id,status,valid_until);

create table if not exists core.subscriptions (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  provider text,
  provider_reference text,
  plan_code text not null,
  status text not null check (status in ('trial','active','past_due','cancelled','expired')),
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists core.integrations (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  provider text not null,
  status text not null default 'inactive' check (status in ('active','inactive','revoked')),
  credentials_reference text, -- referencia segura; NO tokens en texto de Git
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config)='object'),
  created_at timestamptz not null default now(),
  unique (empresa_id, provider)
);
create table if not exists core.webhook_events (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  integration_id uuid not null references core.integrations(id) on delete cascade,
  event_key text not null,
  event_type text not null,
  status text not null default 'received',
  created_at timestamptz not null default now(),
  unique(integration_id,event_key)
);
create table if not exists core.outbox_events (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  event_type text not null,
  subject_id text not null,
  delivery_policy text not null check (delivery_policy in ('single_attempt','retry_idempotent')),
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists core_outbox_status_idx on core.outbox_events(status,created_at);
create table if not exists core.audit_events (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists core_audit_company_date_idx on core.audit_events(empresa_id,occurred_at desc);

-- Ninguna tabla Core tiene acceso directo de anon/authenticated.
-- Todas las consultas operativas se hacen por APIs autorizadas o RPC específica.
do $$
declare table_name text;
begin
  foreach table_name in array ARRAY[
    'products','modules','product_modules','roles','permissions','role_permissions',
    'memberships','membership_roles','entitlements','subscriptions',
    'integrations','webhook_events','outbox_events','audit_events'
  ] loop
    execute format('alter table core.%I enable row level security',table_name);
    execute format('revoke all on core.%I from public, anon, authenticated',table_name);
    execute format('grant select, insert, update, delete on core.%I to service_role',table_name);
  end loop;
end $$;

insert into core.products(code,name)
values ('PETS','Veterinaria'),('PULSE','Boletas y sorteos'),('AURA','Clínicas estéticas'),
 ('VISION','Oftalmología'),('DRIVE','Movilidad'),('NEURO','Educación'),('LENS','Ópticas')
on conflict(code) do nothing;

insert into core.modules(code,name,kind)
values ('INVENTORY','Inventario','shared'),('BILLING','Facturación','shared'),
 ('SCHEDULING','Agenda','shared'),('ANALYTICS','Analítica','shared'),
 ('PETS_CLINICAL','Historias clínicas veterinarias','vertical')
on conflict(code) do nothing;
insert into core.product_modules(product_code,module_code,required)
values ('PETS','PETS_CLINICAL',true)
on conflict(product_code,module_code) do nothing;

insert into core.roles(code,scope,name)
values ('super_admin','platform','Superadministrador'),
 ('empresa_admin','company','Administrador de empresa'),
 ('veterinario','company','Veterinario'),
 ('vendedor','company','Vendedor'),
 ('oficina_admin','company','Responsable de oficina')
on conflict(code) do nothing;

insert into core.permissions(code,name,product_code,module_code) values
 ('core.company.read','Leer empresa',null,null),
 ('core.company.manage','Administrar empresa',null,null),
 ('core.members.manage','Administrar miembros',null,null),
 ('core.entitlements.manage','Administrar licencias',null,null),
 ('pets.pet.read','Consultar mascotas','PETS',null),
 ('pets.pet.write','Editar mascotas','PETS',null),
 ('pets.consultation.read','Consultar historia clínica','PETS',null),
 ('pets.consultation.write','Registrar consulta','PETS',null),
 ('pulse.project.create','Crear proyectos','PULSE',null),
 ('pulse.project.read','Consultar proyectos','PULSE',null),
 ('pulse.ticket.reserve','Reservar boletas','PULSE',null),
 ('pulse.ticket.pay','Registrar pagos','PULSE',null),
 ('pulse.ticket.assign','Asignar boletas','PULSE',null),
 ('pulse.project.delete','Eliminar proyectos','PULSE',null)
on conflict(code) do nothing;

insert into core.role_permissions(role_code,permission_code)
select 'empresa_admin',p.code from core.permissions p
where p.code in ('core.company.read','core.company.manage','core.members.manage',
 'pets.pet.read','pets.pet.write','pets.consultation.read','pets.consultation.write',
 'pulse.project.create','pulse.project.read','pulse.ticket.reserve','pulse.ticket.pay',
 'pulse.ticket.assign','pulse.project.delete')
on conflict do nothing;
insert into core.role_permissions(role_code,permission_code)
select 'veterinario',p.code from core.permissions p
where p.code in ('pets.pet.read','pets.pet.write','pets.consultation.read','pets.consultation.write')
on conflict do nothing;
insert into core.role_permissions(role_code,permission_code)
select 'vendedor',p.code from core.permissions p
where p.code in ('pulse.project.read','pulse.ticket.reserve')
on conflict do nothing;
insert into core.role_permissions(role_code,permission_code)
select 'oficina_admin',p.code from core.permissions p
where p.code in ('pulse.project.read','pulse.ticket.reserve','pulse.ticket.pay')
on conflict do nothing;

-- Inicialización de empresas y usuarios PETS existentes (sin borrar ningún usuario).
insert into core.memberships(empresa_id,user_id,status)
select u.empresa_id,u.id,case when u.activo then 'active' else 'inactive' end
from public.usuarios u where u.empresa_id is not null
on conflict(empresa_id,user_id) do nothing;

insert into core.membership_roles(membership_id,role_code)
select m.id,u.rol::text
from core.memberships m
join public.usuarios u on u.id=m.user_id and u.empresa_id=m.empresa_id
join core.roles r on r.code=u.rol::text and r.scope='company'
on conflict do nothing;

-- Base PETS: habilitar PETS a empresas existentes. No habilita PULSE.
insert into core.entitlements(empresa_id,product_code)
select e.id,'PETS' from public.empresas e
where e.activa
on conflict do nothing;

-- Mantener en coherencia los perfiles PETS nuevos: no depender de ejecuciones manuales.
create or replace function core.sync_profile_membership()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare m_id uuid;
begin
  if tg_op = 'UPDATE' and old.empresa_id is distinct from new.empresa_id and old.empresa_id is not null then
    update core.memberships set status='inactive',updated_at=now()
      where empresa_id=old.empresa_id and user_id=new.id;
  end if;
  if new.empresa_id is null then return new; end if;
  insert into core.memberships(empresa_id,user_id,status)
  values(new.empresa_id,new.id,case when new.activo then 'active' else 'inactive' end)
  on conflict(empresa_id,user_id) do update
    set status=excluded.status,updated_at=now()
  returning id into m_id;
  delete from core.membership_roles where membership_id=m_id;
  if exists(select 1 from core.roles where code=new.rol::text and scope='company') then
    insert into core.membership_roles(membership_id,role_code) values(m_id,new.rol::text);
  end if;
  return new;
end;
$$;
revoke all on function core.sync_profile_membership() from public,anon,authenticated;
drop trigger if exists core_sync_profile_membership on public.usuarios;
create trigger core_sync_profile_membership
after insert or update of empresa_id,rol,activo on public.usuarios
for each row execute function core.sync_profile_membership();

-- Operación de autorización central; únicamente invocable por service_role desde servidor.
-- No aceptar nunca p_actor_id derivado de datos enviados por el navegador.
create or replace function public.core_autorizar_operacion(
  p_actor_id uuid, p_empresa_id uuid, p_permiso text, p_licencia text default null
) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare admin_global boolean;
declare permiso_valido boolean;
begin
  if p_actor_id is null or p_empresa_id is null or nullif(p_permiso,'') is null then
    return false;
  end if;
  if not exists (select 1 from public.empresas e where e.id=p_empresa_id and e.activa) then
    return false;
  end if;
  if not exists (select 1 from core.permissions p where p.code=p_permiso) then
    return false;
  end if;
  select (u.rol='super_admin'::public.rol_usuario)
    into admin_global from public.usuarios u
    where u.id=p_actor_id and u.activo;
  if admin_global is null then return false; end if;

  if not admin_global then
    select exists (
      select 1 from core.memberships m
      join core.membership_roles mr on mr.membership_id=m.id
      join core.role_permissions rp on rp.role_code=mr.role_code
      where m.user_id=p_actor_id and m.empresa_id=p_empresa_id
        and m.status='active' and rp.permission_code=p_permiso
    ) into permiso_valido;
    if not permiso_valido then return false; end if;
  end if;

  -- El permiso debe pertenecer a la licencia que está siendo verificada.
  if p_licencia is not null then
    if not exists (
      select 1 from core.permissions p where p.code=p_permiso
      and (p.product_code=p_licencia or p.module_code=p_licencia
        or (p.product_code is null and p.module_code is null))
    ) then return false; end if;
    if not exists (
      select 1 from core.entitlements ent
      where ent.empresa_id=p_empresa_id
        and ent.status='active' and ent.valid_from<=now()
        and (ent.valid_until is null or ent.valid_until>now())
        and (ent.product_code=p_licencia or ent.module_code=p_licencia)
    ) then return false; end if;
  else
    -- Protegemos automáticamente permisos con producto/módulo asociado,
    -- incluso si un endpoint se olvida de pasar p_licencia.
    if exists (
      select 1 from core.permissions p
      where p.code=p_permiso and (p.product_code is not null or p.module_code is not null)
      and not exists (
        select 1 from core.entitlements ent
        where ent.empresa_id=p_empresa_id
          and ent.status='active' and ent.valid_from<=now()
          and (ent.valid_until is null or ent.valid_until>now())
          and (ent.product_code=p.product_code or ent.module_code=p.module_code)
      )
    ) then return false; end if;
  end if;
  return true;
end;
$$;
revoke all on function public.core_autorizar_operacion(uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.core_autorizar_operacion(uuid,uuid,text,text)
  to service_role;
commit;
