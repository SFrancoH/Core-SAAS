-- Core SaaS · migración combinada 010 → 013
-- Una sola ejecución manual SQL EDITOR / UNA transacción PostgreSQL.
-- SOLO STAGING CONTRASTADO Y RESPALDADO. En producción requiere
-- validación real de RLS A/B, revisión de políticas, y aprobación adicional.
-- No ejecuta Inventory ni migra escrituras PETS legacy todavía.
-- Es instalación inicial exclusiva. Si Core está parcial, ABORTA.
-- Un error cancela/ROLLBACK todo: no se hacen 4 commits independientes.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '180s';

do $preflight$
declare tbl text;
begin
 if to_regclass('core.memberships') is not null
 or to_regclass('core.accounts') is not null
 or to_regclass('core.sedes') is not null then
  raise exception 'CORE_EXISTENTE_O_PARCIAL: auditar esquema e historial antes de migrar';
 end if;
 foreach tbl in array array[
   'public.empresas','public.usuarios','public.mascotas',
   'public.propietarios','public.propietarios_mascotas',
   'public.consultas_controles','public.eventos_mascota'
 ] loop
  if to_regclass(tbl) is null then
   raise exception 'PETS_001_009_INCOMPLETO: %',tbl;
  end if;
 end loop;
 if to_regprocedure('public.registrar_propietario_mascota_pets(uuid,uuid,jsonb,jsonb,text)') is null
 or to_regprocedure('public.asociar_propietario_mascota_pets(uuid,uuid,jsonb)') is null then
  raise exception 'PETS_RPC_LEGACY_FALTANTE';
 end if;
 if not exists(select 1 from information_schema.columns
   where table_schema='public' and table_name='mascotas' and column_name='fuente')
 or not exists(select 1 from information_schema.columns
   where table_schema='public' and table_name='propietarios' and column_name='fuente') then
  raise exception 'PETS_FUENTE_FALTANTE';
 end if;
 if (select count(*) from public.usuarios where rol='super_admin' and activo)>1 then
  raise exception 'SUPERADMIN_DUPLICADO';
 end if;
end;
$preflight$;


-- ========= 010_core_access.sql =========
-- Core SaaS 010: catálogo de productos, membresías, roles y licencias.
-- Diseñada a partir de public.empresas (uuid) y public.usuarios / auth.users (migración 001).
-- NO ejecutar hasta comparar esquema real, probar en entorno no productivo y respaldar.
-- No altera ni elimina registros PETS; crea esquema propio y sincroniza membresías.
-- inicio de 010_core_access.sql: transacción global

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
-- fin de 010_core_access.sql: transacción global



-- ========= 011_core_identity_multitenant.sql =========
-- 011: IDENTIDAD GLOBAL Y MEMBRESÍAS MULTIEMPRESA - CORE SAAS
-- DEPENDE DE 010_core_access.sql; DISEÑO VERSIONADO, NO EJECUTADO.
-- Antes de aplicar: ejecutar PREFLIGHT_CORE.sql, confirmar backup/RLS y probar con 2 empresas.
-- No cambia ni elimina las columnas legacy PETS de public.usuarios en esta fase.
-- inicio de 011_core_identity_multitenant.sql: transacción global
create schema if not exists core;
revoke all on schema core from public,anon,authenticated;
grant usage on schema core to service_role;

-- Identidad global 1:1 con Supabase Auth (un solo correo/login para todas las empresas).
create table if not exists core.accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 2 and 120),
  email text not null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists core_accounts_email_unique on core.accounts(lower(email));
insert into core.accounts(user_id,nombre,email,active,created_by)
select id,nombre,email,activo,creado_por from public.usuarios
on conflict(user_id) do nothing;

-- Los únicos 4 roles del producto:
-- PLATFORM: super_admin (propietario único), super_user (empleado interno).
-- COMPANY: admin, user. El cargo específico de PETS/PULSE se expresa en permisos.
create table if not exists core.platform_staff (
  user_id uuid primary key references core.accounts(user_id) on delete cascade,
  role text not null check(role in ('super_admin','super_user')),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists core_only_one_super_admin
  on core.platform_staff((role)) where role='super_admin';
insert into core.platform_staff(user_id,role,created_by)
select id,'super_admin',creado_por from public.usuarios
where rol='super_admin' and activo
on conflict(user_id) do nothing;

alter table core.memberships
  add column if not exists company_role text not null default 'user'
    check(company_role in ('admin','user')),
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;
update core.memberships m
set company_role=case when u.rol='empresa_admin' then 'admin' else 'user' end
from public.usuarios u
where m.user_id=u.id and m.empresa_id=u.empresa_id
  and u.rol in ('empresa_admin','veterinario');
-- El trigger 010 sigue sincronizando memberships legacy. El rol canónico es
-- core.memberships.company_role y NO public.usuarios.rol ni membership_roles.

create table if not exists core.membership_permissions (
  membership_id uuid not null references core.memberships(id) on delete cascade,
  permission_code text not null references core.permissions(code) on delete restrict,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (membership_id,permission_code)
);
-- Preservar permisos PETS actuales al preparar compatibilidad con control Core.
insert into core.membership_permissions(membership_id,permission_code)
select m.id,p.code
from core.memberships m
join public.usuarios u on u.id=m.user_id and u.empresa_id=m.empresa_id
join core.permissions p on p.product_code='PETS'
where u.rol in ('empresa_admin','veterinario')
on conflict do nothing;
insert into core.membership_permissions(membership_id,permission_code)
select m.id,'core.members.manage'
from core.memberships m
where m.company_role='admin'
on conflict do nothing;

-- Super-User requiere grants explícitos por empresa y permiso; jamás hereda Super-Admin.
create table if not exists core.platform_permission_grants (
  staff_user_id uuid not null references core.platform_staff(user_id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  permission_code text not null references core.permissions(code) on delete cascade,
  assigned_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key(staff_user_id,empresa_id,permission_code)
);

-- Auditoría inmutable para creación/asignación, cambio de rol y acceso de soporte.
-- core.audit_events ya existe desde 010 y conserva actor_id + empresa_id.
create table if not exists core.support_sessions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  subject_id uuid not null references auth.users(id),
  empresa_id uuid not null references public.empresas(id),
  reason text not null check(char_length(btrim(reason)) between 10 and 500),
  read_only boolean not null default true check(read_only),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '15 minutes'),
  revoked_at timestamptz,
  constraint core_support_different_users check (actor_id<>subject_id)
);
create index if not exists core_support_actor_active_idx
  on core.support_sessions(actor_id,expires_at)
  where revoked_at is null;

-- Todo el esquema Core está cerrado a clientes; solo RPC concretas server-side.
do $$
declare name text;
begin
  foreach name in array array[
    'accounts','platform_staff','membership_permissions',
    'platform_permission_grants','support_sessions'
  ] loop
    execute format('alter table core.%I enable row level security',name);
    execute format('revoke all on core.%I from public,anon,authenticated',name);
    execute format('grant select,insert,update,delete on core.%I to service_role',name);
  end loop;
end $$;

-- El permiso efectivo SIEMPRE requiere cuenta activa, empresa activa, grant
-- explícito y licencia vigente (si es permiso de vertical).
create or replace function core.effective_permission(
  p_user uuid, p_empresa uuid, p_permission text
) returns boolean language sql stable security definer set search_path=''
as $$
 select coalesce(
   exists(
     select 1 from core.accounts a
     join public.empresas e on e.id=p_empresa and e.activa
     join core.platform_staff st on st.user_id=a.user_id and st.active
     where a.user_id=p_user and a.active and st.role='super_admin'
   ) or exists(
     select 1 from core.accounts a
     join public.empresas e on e.id=p_empresa and e.activa
     join core.platform_staff st on st.user_id=a.user_id and st.active and st.role='super_user'
     join core.platform_permission_grants gp on gp.staff_user_id=st.user_id
          and gp.empresa_id=p_empresa and gp.permission_code=p_permission
     join core.permissions p on p.code=gp.permission_code
     where a.user_id=p_user and a.active
       and (p.product_code is null or exists(
         select 1 from core.entitlements t where t.empresa_id=p_empresa
         and t.product_code=p.product_code and t.status='active'
         and t.valid_from<=now() and (t.valid_until is null or t.valid_until>now())))
       and (p.module_code is null or exists(
         select 1 from core.entitlements t where t.empresa_id=p_empresa
         and t.module_code=p.module_code and t.status='active'
         and t.valid_from<=now() and (t.valid_until is null or t.valid_until>now())))
   ) or exists(
     select 1 from core.accounts a
     join core.memberships m on m.user_id=a.user_id
       and m.empresa_id=p_empresa and m.status='active'
     join public.empresas e on e.id=m.empresa_id and e.activa
     join core.membership_permissions mp on mp.membership_id=m.id
       and mp.permission_code=p_permission
     join core.permissions p on p.code=mp.permission_code
     where a.user_id=p_user and a.active
       and (p.product_code is null or exists(
         select 1 from core.entitlements t where t.empresa_id=p_empresa
         and t.product_code=p.product_code and t.status='active'
         and t.valid_from<=now() and (t.valid_until is null or t.valid_until>now())))
       and (p.module_code is null or exists(
         select 1 from core.entitlements t where t.empresa_id=p_empresa
         and t.module_code=p.module_code and t.status='active'
         and t.valid_from<=now() and (t.valid_until is null or t.valid_until>now())))
   ),false
 );
$$;
revoke all on function core.effective_permission(uuid,uuid,text) from public,anon,authenticated;
grant execute on function core.effective_permission(uuid,uuid,text) to service_role;

-- Reemplaza autorización 010 para funciones CORE NUEVAS.
-- No habilita aún las rutas legacy PETS: deben adoptar contexto explícito + RLS.
create or replace function public.core_autorizar_operacion(
 p_actor_id uuid, p_empresa_id uuid, p_permiso text, p_licencia text default null
) returns boolean language plpgsql stable security definer set search_path=''
as $$
declare perm_product text; perm_module text;
begin
 if p_actor_id is null or p_empresa_id is null or nullif(p_permiso,'') is null then return false; end if;
 select product_code,module_code into perm_product,perm_module
   from core.permissions where code=p_permiso;
 if not found then return false; end if;
 if p_licencia is not null and not (
    p_licencia=perm_product or p_licencia=perm_module
    or (perm_product is null and perm_module is null)
 ) then return false; end if;
 if p_licencia is not null and not exists(
   select 1 from core.entitlements t where t.empresa_id=p_empresa_id
   and t.status='active' and t.valid_from<=now()
   and (t.valid_until is null or t.valid_until>now())
   and (t.product_code=p_licencia or t.module_code=p_licencia)
 ) then return false; end if;
 return core.effective_permission(p_actor_id,p_empresa_id,p_permiso);
end;
$$;
revoke all on function public.core_autorizar_operacion(uuid,uuid,text,text)
 from public,anon,authenticated;
grant execute on function public.core_autorizar_operacion(uuid,uuid,text,text) to service_role;

-- Identidad cuando no existe perfil PETS legacy. Se usa exclusivamente desde
-- backend tras autenticar auth.getUser; p_actor nunca se toma del cuerpo HTTP.
create or replace function public.core_identity(p_actor_id uuid)
returns jsonb language sql stable security definer set search_path=''
as $$
 select jsonb_build_object(
  'id',a.user_id,'nombre',a.nombre,'email',a.email,'activo',a.active,
  'rol',coalesce(
    (select st.role from core.platform_staff st where st.user_id=a.user_id and st.active),
    'user'
  ),'empresa_id',null)
 from core.accounts a where a.user_id=p_actor_id and a.active
$$;
revoke all on function public.core_identity(uuid) from public,anon,authenticated;
grant execute on function public.core_identity(uuid) to service_role;

-- RPC del selector de verticales: no permite inventar licencias desde la UI.
create or replace function public.core_portal_access(p_actor_id uuid)
returns jsonb language sql stable security definer set search_path=''
as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'company_id',m.empresa_id, 'company_name',e.nombre,
  'company_active',e.activa,'membership_active',m.status='active',
  'role',m.company_role,'products',pc.products
 ) order by e.nombre), '[]'::jsonb)
 from core.memberships m
 join core.accounts a on a.user_id=m.user_id and a.active
 join public.empresas e on e.id=m.empresa_id and e.activa
 cross join lateral(
   select coalesce(jsonb_agg(distinct ent.product_code), '[]'::jsonb) as products
   from core.entitlements ent
   where ent.empresa_id=m.empresa_id and ent.product_code is not null
     and ent.status='active' and ent.valid_from<=now()
     and (ent.valid_until is null or ent.valid_until>now())
     and exists (
       select 1 from core.membership_permissions mp
       join core.permissions p on p.code=mp.permission_code
       where mp.membership_id=m.id and p.product_code=ent.product_code
     )
 ) pc
 where m.user_id=p_actor_id and m.status='active' and pc.products<>'[]'::jsonb
$$;
revoke all on function public.core_portal_access(uuid) from public,anon,authenticated;
grant execute on function public.core_portal_access(uuid) to service_role;

-- Crear/asignar membresía SOLO por actor que ya pasó Supabase Auth, y registrar
-- actor real. Nunca aceptar company id ni permisos solo porque lleguen en POST.
create or replace function public.core_assign_membership(
 p_actor_id uuid, p_subject_id uuid, p_empresa_id uuid, p_role text,
 p_permissions text[]
) returns uuid language plpgsql security definer set search_path=''
as $$
declare is_owner boolean; actor_membership uuid; new_membership uuid; granted int;
begin
 if p_actor_id is null or p_subject_id is null or p_empresa_id is null
   or p_role not in ('admin','user') or p_permissions is null then
   raise exception 'INVALID_ASSIGNMENT' using errcode='22023';
 end if;
 if not exists(select 1 from core.accounts where user_id=p_subject_id and active) or
    not exists(select 1 from public.empresas where id=p_empresa_id and activa) then
   raise exception 'TARGET_INACTIVE' using errcode='42501';
 end if;
 select exists(
  select 1 from core.platform_staff s join core.accounts a on a.user_id=s.user_id
   where s.user_id=p_actor_id and s.role='super_admin' and s.active and a.active
 ) into is_owner;
 if not is_owner then
   select m.id into actor_membership
   from core.memberships m join core.accounts a on a.user_id=m.user_id and a.active
   where m.user_id=p_actor_id and m.empresa_id=p_empresa_id
     and m.company_role='admin' and m.status='active';
   if actor_membership is null or
     not core.effective_permission(p_actor_id,p_empresa_id,'core.members.manage') then
     raise exception 'FORBIDDEN' using errcode='42501';
   end if;
 end if;
 -- Todos los permisos deben existir y corresponder a licencias activas. Admin
 -- solo puede delegar permisos que tenga efectivos él mismo.
 select count(distinct p.code) into granted from core.permissions p
 where p.code=any(p_permissions)
   and (p.product_code is null or exists (
     select 1 from core.entitlements e where e.empresa_id=p_empresa_id
      and e.product_code=p.product_code and e.status='active'
      and e.valid_from<=now() and (e.valid_until is null or e.valid_until>now())
   ))
   and (p.module_code is null or exists (
     select 1 from core.entitlements e where e.empresa_id=p_empresa_id
      and e.module_code=p.module_code and e.status='active'
      and e.valid_from<=now() and (e.valid_until is null or e.valid_until>now())
   ))
   -- Ningún rol de empresa recibe control de licencias, personal Core,
   -- auditoría global u otros permisos de plataforma, ni por petición maliciosa.
   and (p.code not like 'core.%' or p.code in (
     'core.company.read','core.company.manage','core.members.manage'
   ))
   and (p_role='admin' or p.code not in (
     'core.company.manage','core.members.manage'
   ))
   and (is_owner or core.effective_permission(p_actor_id,p_empresa_id,p.code));
 if granted <> coalesce(array_length(array(select distinct unnest(p_permissions)),1),0) then
   raise exception 'INVALID_PERMISSION_SET' using errcode='42501';
 end if;
 insert into core.memberships(empresa_id,user_id,company_role,status,created_by,updated_by)
 values(p_empresa_id,p_subject_id,p_role,'active',p_actor_id,p_actor_id)
 on conflict(empresa_id,user_id) do update
   set company_role=excluded.company_role,status='active',updated_by=p_actor_id,updated_at=now()
 returning id into new_membership;
 delete from core.membership_permissions where membership_id=new_membership;
 insert into core.membership_permissions(membership_id,permission_code,assigned_by)
 select new_membership,distinct_codes.code,p_actor_id
 from (select distinct unnest(p_permissions) as code) distinct_codes;
 insert into core.audit_events(empresa_id,actor_id,event_type,resource_id,metadata)
 values(p_empresa_id,p_actor_id,'core.membership.assigned',p_subject_id::text,
   jsonb_build_object('role',p_role,'permissions',p_permissions));
 return new_membership;
end;
$$;
revoke all on function public.core_assign_membership(uuid,uuid,uuid,text,text[])
 from public,anon,authenticated;
grant execute on function public.core_assign_membership(uuid,uuid,uuid,text,text[])
 to service_role;

-- Modo soporte: únicamente vista previa de permisos, no Auth del sujeto.
-- Bloquear escrituras y acceso a rutas PETS legacy mientras exista cookie soporte.
create or replace function public.core_support_begin(
 p_actor_id uuid,p_subject_id uuid,p_empresa_id uuid,p_reason text
) returns uuid language plpgsql security definer set search_path=''
as $$
declare session_id uuid;
begin
 if p_actor_id=p_subject_id or char_length(btrim(coalesce(p_reason,'')))<10
   or not exists (
     select 1 from core.platform_staff s join core.accounts a on a.user_id=s.user_id
     where s.user_id=p_actor_id and s.role='super_admin' and s.active and a.active
   )
   or not exists (
     select 1 from core.memberships m join core.accounts a on a.user_id=m.user_id
     join public.empresas e on e.id=m.empresa_id
     where m.user_id=p_subject_id and m.empresa_id=p_empresa_id
     and m.status='active' and a.active and e.activa
   ) then raise exception 'FORBIDDEN_SUPPORT_VIEW' using errcode='42501';
 end if;
 insert into core.support_sessions(actor_id,subject_id,empresa_id,reason)
 values(p_actor_id,p_subject_id,p_empresa_id,btrim(p_reason))
 returning id into session_id;
 insert into core.audit_events(empresa_id,actor_id,event_type,resource_id,metadata)
 values(p_empresa_id,p_actor_id,'core.support.started',p_subject_id::text,
 jsonb_build_object('support_session',session_id,'read_only',true,'reason',btrim(p_reason)));
 return session_id;
end;
$$;
revoke all on function public.core_support_begin(uuid,uuid,uuid,text)
 from public,anon,authenticated;
grant execute on function public.core_support_begin(uuid,uuid,uuid,text) to service_role;

create or replace function public.core_support_end(p_actor_id uuid,p_session_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v core.support_sessions%rowtype;
begin
 update core.support_sessions set revoked_at=now()
 where id=p_session_id and actor_id=p_actor_id
 and revoked_at is null
 returning * into v;
 if not found then return false; end if;
 insert into core.audit_events(empresa_id,actor_id,event_type,resource_id,metadata)
 values(v.empresa_id,p_actor_id,'core.support.ended',v.subject_id::text,
 jsonb_build_object('support_session',p_session_id));
 return true;
end;
$$;
revoke all on function public.core_support_end(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.core_support_end(uuid,uuid) to service_role;

create or replace function public.core_support_status(p_actor_id uuid,p_session_id uuid)
returns jsonb language sql stable security definer set search_path=''
as $$
 select jsonb_build_object(
  'id',s.id,'subject_id',s.subject_id,'subject_name',a.nombre,
  'company_id',s.empresa_id,'company_name',e.nombre,
  'expires_at',s.expires_at,'read_only',true
 )
 from core.support_sessions s
 join core.accounts a on a.user_id=s.subject_id and a.active
 join public.empresas e on e.id=s.empresa_id and e.activa
 where s.id=p_session_id and s.actor_id=p_actor_id and s.revoked_at is null
 and s.expires_at>now()
$$;
revoke all on function public.core_support_status(uuid,uuid) from public,anon,authenticated;
grant execute on function public.core_support_status(uuid,uuid) to service_role;

-- Directorio visible únicamente al propietario autenticado en servidor.
create or replace function public.core_support_directory(p_actor_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare result jsonb;
begin
 if not exists(
   select 1 from core.platform_staff st join core.accounts a on a.user_id=st.user_id
   where st.user_id=p_actor_id and st.role='super_admin' and st.active and a.active
 ) then return '[]'::jsonb; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'subject_id',m.user_id,'subject_name',a.nombre,'subject_email',a.email,
   'company_id',m.empresa_id,'company_name',e.nombre,'role',m.company_role
 ) order by e.nombre,a.nombre),'[]'::jsonb)
 into result
 from core.memberships m join core.accounts a on a.user_id=m.user_id and a.active
 join public.empresas e on e.id=m.empresa_id and e.activa
 where m.status='active' and m.user_id<>p_actor_id;
 return result;
end;
$$;
revoke all on function public.core_support_directory(uuid) from public,anon,authenticated;
grant execute on function public.core_support_directory(uuid) to service_role;

-- Vista efectiva del target (sin acceso a filas clínicas ni JWT del target).
create or replace function public.core_support_snapshot(p_actor_id uuid,p_session_id uuid)
returns jsonb language sql stable security definer set search_path=''
as $$
 select jsonb_build_object(
  'subject_id',s.subject_id,'subject_name',a.nombre,'company_id',m.empresa_id,
  'company_name',e.nombre,'company_role',m.company_role,
  'permissions',coalesce((
    select jsonb_agg(mp.permission_code order by mp.permission_code)
    from core.membership_permissions mp join core.permissions p on p.code=mp.permission_code
    where mp.membership_id=m.id
      and (p.product_code is null or exists (
        select 1 from core.entitlements ent
        where ent.empresa_id=m.empresa_id and ent.product_code=p.product_code
          and ent.status='active' and ent.valid_from<=now()
          and (ent.valid_until is null or ent.valid_until>now())))
  ),'[]'::jsonb),
  'products',coalesce((
    select jsonb_agg(ent.product_code order by ent.product_code)
    from core.entitlements ent
    where ent.empresa_id=m.empresa_id and ent.product_code is not null
      and ent.status='active' and ent.valid_from<=now()
      and (ent.valid_until is null or ent.valid_until>now())
      and exists (
        select 1 from core.membership_permissions mp join core.permissions p on p.code=mp.permission_code
        where mp.membership_id=m.id and p.product_code=ent.product_code
      )
  ),'[]'::jsonb)
 )
 from core.support_sessions s
 join core.accounts a on a.user_id=s.subject_id and a.active
 join core.memberships m on m.user_id=s.subject_id and m.empresa_id=s.empresa_id and m.status='active'
 join public.empresas e on e.id=m.empresa_id and e.activa
 where s.id=p_session_id and s.actor_id=p_actor_id
 and s.revoked_at is null and s.expires_at>now() and s.read_only
$$;
revoke all on function public.core_support_snapshot(uuid,uuid) from public,anon,authenticated;
grant execute on function public.core_support_snapshot(uuid,uuid) to service_role;


-- Registro de cuenta previamente invitada/creada en Supabase Auth.
-- Garantiza autoría inmutable y que correo/UUID existen realmente en Auth.
create or replace function public.core_register_account(
 p_actor_id uuid, p_user_id uuid, p_nombre text, p_email text
) returns boolean language plpgsql security definer set search_path=''
as $$
declare can_manage boolean;
begin
 if p_actor_id is null or p_user_id is null
    or char_length(btrim(coalesce(p_nombre,''))) not between 2 and 120
    or nullif(btrim(coalesce(p_email,'')),'') is null then
   raise exception 'INVALID_ACCOUNT' using errcode='22023';
 end if;
 select exists(
   select 1 from core.platform_staff st join core.accounts a on a.user_id=st.user_id
   where st.user_id=p_actor_id and st.role='super_admin' and st.active and a.active
 ) or exists(
   select 1 from core.memberships m join core.accounts a on a.user_id=m.user_id
   where m.user_id=p_actor_id and m.company_role='admin' and m.status='active'
   and a.active and core.effective_permission(p_actor_id,m.empresa_id,'core.members.manage')
 ) into can_manage;
 if not can_manage then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if not exists(
   select 1 from auth.users au
   where au.id=p_user_id and lower(au.email)=lower(p_email)
 ) then raise exception 'AUTH_USER_NOT_FOUND' using errcode='42501'; end if;
 insert into core.accounts(user_id,nombre,email,created_by)
 values(p_user_id,btrim(p_nombre),lower(btrim(p_email)),p_actor_id)
 on conflict(user_id) do nothing;
 if found then
   insert into core.audit_events(actor_id,event_type,resource_id,metadata)
   values(p_actor_id,'core.account.created',p_user_id::text,
    jsonb_build_object('name',btrim(p_nombre)));
 end if;
 return true;
end;
$$;
revoke all on function public.core_register_account(uuid,uuid,text,text)
 from public,anon,authenticated;
grant execute on function public.core_register_account(uuid,uuid,text,text) to service_role;

-- El propietario puede crear Super-Users, jamás un segundo Super-Admin.
create or replace function public.core_assign_staff(
 p_actor_id uuid,p_subject_id uuid,p_role text
) returns boolean language plpgsql security definer set search_path=''
as $$
begin
 if p_role<>'super_user' or p_actor_id=p_subject_id
   or not exists(
     select 1 from core.platform_staff st join core.accounts a on a.user_id=st.user_id
     where st.user_id=p_actor_id and st.role='super_admin' and st.active and a.active
   ) or not exists(select 1 from core.accounts a where a.user_id=p_subject_id and a.active)
 then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if exists(select 1 from core.platform_staff where user_id=p_subject_id and role='super_admin')
 then raise exception 'CANNOT_CHANGE_OWNER' using errcode='42501'; end if;
 insert into core.platform_staff(user_id,role,created_by)
 values(p_subject_id,'super_user',p_actor_id)
 on conflict(user_id) do update set role='super_user',active=true;
 insert into core.audit_events(actor_id,event_type,resource_id,metadata)
 values(p_actor_id,'core.staff.assigned',p_subject_id::text,
  jsonb_build_object('role','super_user'));
 return true;
end;
$$;
revoke all on function public.core_assign_staff(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.core_assign_staff(uuid,uuid,text) to service_role;

-- Asociación a varias empresas en una sola transacción.
-- Cada item: { company_id, role: admin|user, permissions:[...] }.
create or replace function public.core_assign_multiple_memberships(
 p_actor_id uuid,p_subject_id uuid,p_assignments jsonb
) returns integer language plpgsql security definer set search_path=''
as $$
declare item jsonb; n integer:=0; company_id uuid;
declare role_code text; perms text[];
begin
 if p_actor_id is null or p_subject_id is null
   or jsonb_typeof(p_assignments)<>'array'
   or jsonb_array_length(p_assignments) not between 1 and 20
 then raise exception 'INVALID_ASSIGNMENTS' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(p_assignments) loop
   if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'permissions')<>'array'
   then raise exception 'INVALID_ASSIGNMENT' using errcode='22023'; end if;
   company_id:=(item->>'company_id')::uuid;
   role_code:=item->>'role';
   select coalesce(array_agg(value),array[]::text[])
      into perms from jsonb_array_elements_text(item->'permissions') as v(value);
   perform public.core_assign_membership(
     p_actor_id,p_subject_id,company_id,role_code,perms
   );
   n:=n+1;
 end loop;
 return n;
end;
$$;
revoke all on function public.core_assign_multiple_memberships(uuid,uuid,jsonb)
 from public,anon,authenticated;
grant execute on function public.core_assign_multiple_memberships(uuid,uuid,jsonb)
 to service_role;


-- Las siguientes RPC solo se invocan desde servidor con service_role
-- DESPUÉS de resolver actor.id desde Supabase Auth.
create or replace function public.core_permission_catalog(p_actor_id uuid,p_empresa_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v jsonb;
begin
 if not core.effective_permission(p_actor_id,p_empresa_id,'core.members.manage') then
   return '[]'::jsonb;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'code',p.code,'name',p.name,'product',p.product_code,'module',p.module_code
 ) order by p.product_code nulls first,p.code),'[]'::jsonb)
 into v from core.permissions p
 where (p.product_code is null or exists(
  select 1 from core.entitlements e where e.empresa_id=p_empresa_id
  and e.product_code=p.product_code and e.status='active'
  and e.valid_from<=now() and (e.valid_until is null or e.valid_until>now())
 ))
 and (p.module_code is null or exists(
  select 1 from core.entitlements e where e.empresa_id=p_empresa_id
  and e.module_code=p.module_code and e.status='active'
  and e.valid_from<=now() and (e.valid_until is null or e.valid_until>now())
 ))
 and core.effective_permission(p_actor_id,p_empresa_id,p.code);
 return v;
end;
$$;
revoke all on function public.core_permission_catalog(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.core_permission_catalog(uuid,uuid) to service_role;

create or replace function public.core_company_members(p_actor_id uuid,p_empresa_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v jsonb;
begin
 if not core.effective_permission(p_actor_id,p_empresa_id,'core.members.manage') then
   return '[]'::jsonb;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'user_id',m.user_id,'name',a.nombre,'email',a.email,
  'role',m.company_role,'active',m.status='active',
  'created_by',m.created_by,'creator_name',creator.nombre,
  'permissions',coalesce((
   select jsonb_agg(mp.permission_code order by mp.permission_code)
   from core.membership_permissions mp where mp.membership_id=m.id
  ),'[]'::jsonb)
 ) order by a.nombre),'[]'::jsonb) into v
 from core.memberships m join core.accounts a on a.user_id=m.user_id
 left join core.accounts creator on creator.user_id=m.created_by
 where m.empresa_id=p_empresa_id;
 return v;
end;
$$;
revoke all on function public.core_company_members(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.core_company_members(uuid,uuid) to service_role;

-- Sólo el propietario puede asociar una cuenta preexistente por correo;
-- Admin local debe usar invitación aceptada, nunca enrolar silenciosamente.
create or replace function public.core_find_account(p_actor_id uuid,p_email text)
returns uuid language plpgsql stable security definer set search_path=''
as $$
begin
 if not exists(
  select 1 from core.platform_staff st join core.accounts a on a.user_id=st.user_id
  where st.user_id=p_actor_id and st.role='super_admin' and st.active and a.active
 ) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 return (select user_id from core.accounts
  where lower(email)=lower(btrim(p_email)) and active);
end;
$$;
revoke all on function public.core_find_account(uuid,text) from public,anon,authenticated;
grant execute on function public.core_find_account(uuid,text) to service_role;

-- fin de 011_core_identity_multitenant.sql: transacción global



-- ========= 012_pets_multitenant_rls.sql =========
-- 012 · PETS: RLS por membresía multiempresa y licencia activa
-- REQUIERE migraciones 001-011 instaladas y verificadas sobre Supabase CORE.
-- NO APLICAR a producción sin backup restaurable y E2E A/B en staging.
-- El backend deberá usar un tenant explícito en cada consulta y guard de permiso.
-- Esta migración NO despliega rutas, no altera datos clínicos ni ejecuta GRANT indiscriminado.
-- inicio de 012_pets_multitenant_rls.sql: transacción global

do $$
declare v text;
begin
 if to_regclass('core.accounts') is null
 or to_regclass('core.memberships') is null
 or to_regclass('core.membership_permissions') is null
 or to_regclass('core.entitlements') is null
 or to_regprocedure('core.effective_permission(uuid,uuid,text)') is null then
   raise exception 'CORE_010_011_REQUIRED';
 end if;
 -- Ante políticas añadidas manualmente detener el despliegue: las políticas
 -- permisivas en PostgreSQL se combinan con OR y podrían saltar aislamiento.
 for v in
   select format('%I.%I policy %I',schemaname,tablename,policyname)
   from pg_policies
   where schemaname='public'
   and tablename in ('mascotas','propietarios','propietarios_mascotas',
                     'consultas_controles','eventos_mascota')
   and policyname not in (
     'mascotas_lectura_por_empresa','mascotas_creacion_por_empresa',
     'mascotas_edicion_por_empresa','mascotas_eliminacion_por_empresa',
     'propietarios_lectura_por_empresa','propietarios_creacion_por_empresa',
     'propietarios_edicion_por_empresa','propietarios_eliminacion_por_empresa',
     'propietarios_mascotas_lectura','propietarios_mascotas_creacion',
     'propietarios_mascotas_eliminacion',
     'consultas_controles_lectura_por_empresa',
     'consultas_controles_creacion_por_empresa',
     'consultas_controles_edicion_por_empresa',
     'consultas_controles_eliminacion_por_empresa',
     'eventos_mascota_lectura_empresa',
     'pets_core_read','pets_core_insert','pets_core_update','pets_core_delete',
     'pets_core_event_read'
   )
 loop
   raise exception 'UNEXPECTED_RLS_POLICY: %',v;
 end loop;
end $$;

-- La identidad se obtiene EXCLUSIVAMENTE del JWT verificado de Supabase.
-- El argumento company_id de una URL o body nunca se considera autorización.
create or replace function private.pets_tenant_allowed(p_empresa_id uuid,p_permission text)
returns boolean language sql stable security definer set search_path=''
as $$
 select coalesce(
    auth.uid() is not null
    and p_empresa_id is not null
    and p_permission in ('pets.pet.read','pets.pet.write',
                         'pets.consultation.read','pets.consultation.write')
    and exists (
      select 1 from public.empresas e where e.id=p_empresa_id and e.activa
    )
    and exists (
      select 1 from core.entitlements e
      where e.empresa_id=p_empresa_id and e.product_code='PETS'
        and e.status='active' and e.valid_from<=now()
        and (e.valid_until is null or e.valid_until>now())
    )
    and core.effective_permission(auth.uid(),p_empresa_id,p_permission)
 ,false);
$$;
revoke all on function private.pets_tenant_allowed(uuid,text) from public,anon;
grant execute on function private.pets_tenant_allowed(uuid,text) to authenticated;

-- Misma regla utilizada por la API tras verificar su sesión real.
create or replace function public.core_pets_tenant_access(
 p_actor_id uuid,p_empresa_id uuid,p_permission text
) returns boolean language sql stable security definer set search_path=''
as $$
 select coalesce(
   p_actor_id is not null and p_empresa_id is not null
   and p_permission in ('pets.pet.read','pets.pet.write',
                        'pets.consultation.read','pets.consultation.write')
   and exists (select 1 from public.empresas e where e.id=p_empresa_id and e.activa)
   and exists (
     select 1 from core.entitlements e
     where e.empresa_id=p_empresa_id and e.product_code='PETS'
       and e.status='active' and e.valid_from<=now()
       and (e.valid_until is null or e.valid_until>now())
   )
   and core.effective_permission(p_actor_id,p_empresa_id,p_permission)
 ,false);
$$;
revoke all on function public.core_pets_tenant_access(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.core_pets_tenant_access(uuid,uuid,text) to service_role;

-- Usar políticas *RESTRICTIVE* no sirve mientras existan políticas históricas
-- permisivas; se sustituyen atómicamente dentro de la transacción.

-- Tabla mascotas: lectura/escritura de la MISMA empresa del recurso.
drop policy if exists mascotas_lectura_por_empresa on public.mascotas;
drop policy if exists mascotas_creacion_por_empresa on public.mascotas;
drop policy if exists mascotas_edicion_por_empresa on public.mascotas;
drop policy if exists mascotas_eliminacion_por_empresa on public.mascotas;
drop policy if exists pets_core_read on public.mascotas;
drop policy if exists pets_core_insert on public.mascotas;
drop policy if exists pets_core_update on public.mascotas;
drop policy if exists pets_core_delete on public.mascotas;
create policy pets_core_read on public.mascotas for select to authenticated using (private.pets_tenant_allowed(empresa_id,'pets.pet.read'));
create policy pets_core_insert on public.mascotas for insert to authenticated with check (private.pets_tenant_allowed(empresa_id,'pets.pet.write'));
create policy pets_core_update on public.mascotas for update to authenticated using (private.pets_tenant_allowed(empresa_id,'pets.pet.write')) with check (private.pets_tenant_allowed(empresa_id,'pets.pet.write'));
create policy pets_core_delete on public.mascotas for delete to authenticated using (private.pets_tenant_allowed(empresa_id,'pets.pet.write'));

-- Tabla propietarios: lectura/escritura de la MISMA empresa del recurso.
drop policy if exists propietarios_lectura_por_empresa on public.propietarios;
drop policy if exists propietarios_creacion_por_empresa on public.propietarios;
drop policy if exists propietarios_edicion_por_empresa on public.propietarios;
drop policy if exists propietarios_eliminacion_por_empresa on public.propietarios;
drop policy if exists pets_core_read on public.propietarios;
drop policy if exists pets_core_insert on public.propietarios;
drop policy if exists pets_core_update on public.propietarios;
drop policy if exists pets_core_delete on public.propietarios;
create policy pets_core_read on public.propietarios for select to authenticated using (private.pets_tenant_allowed(empresa_id,'pets.pet.read'));
create policy pets_core_insert on public.propietarios for insert to authenticated with check (private.pets_tenant_allowed(empresa_id,'pets.pet.write'));
create policy pets_core_update on public.propietarios for update to authenticated using (private.pets_tenant_allowed(empresa_id,'pets.pet.write')) with check (private.pets_tenant_allowed(empresa_id,'pets.pet.write'));
create policy pets_core_delete on public.propietarios for delete to authenticated using (private.pets_tenant_allowed(empresa_id,'pets.pet.write'));

-- Tabla propietarios_mascotas: lectura/escritura de la MISMA empresa del recurso.
drop policy if exists propietarios_mascotas_lectura on public.propietarios_mascotas;
drop policy if exists propietarios_mascotas_creacion on public.propietarios_mascotas;
drop policy if exists propietarios_mascotas_eliminacion on public.propietarios_mascotas;
drop policy if exists pets_core_read on public.propietarios_mascotas;
drop policy if exists pets_core_insert on public.propietarios_mascotas;
drop policy if exists pets_core_update on public.propietarios_mascotas;
drop policy if exists pets_core_delete on public.propietarios_mascotas;
create policy pets_core_read on public.propietarios_mascotas for select to authenticated using (private.pets_tenant_allowed(empresa_id,'pets.pet.read'));
create policy pets_core_insert on public.propietarios_mascotas for insert to authenticated with check (private.pets_tenant_allowed(empresa_id,'pets.pet.write'));
create policy pets_core_delete on public.propietarios_mascotas for delete to authenticated using (private.pets_tenant_allowed(empresa_id,'pets.pet.write'));

-- Tabla consultas_controles: lectura/escritura de la MISMA empresa del recurso.
drop policy if exists consultas_controles_lectura_por_empresa on public.consultas_controles;
drop policy if exists consultas_controles_creacion_por_empresa on public.consultas_controles;
drop policy if exists consultas_controles_edicion_por_empresa on public.consultas_controles;
drop policy if exists consultas_controles_eliminacion_por_empresa on public.consultas_controles;
drop policy if exists pets_core_read on public.consultas_controles;
drop policy if exists pets_core_insert on public.consultas_controles;
drop policy if exists pets_core_update on public.consultas_controles;
drop policy if exists pets_core_delete on public.consultas_controles;
create policy pets_core_read on public.consultas_controles for select to authenticated using (private.pets_tenant_allowed(empresa_id,'pets.consultation.read'));
create policy pets_core_insert on public.consultas_controles for insert to authenticated with check (private.pets_tenant_allowed(empresa_id,'pets.consultation.write'));
create policy pets_core_update on public.consultas_controles for update to authenticated using (private.pets_tenant_allowed(empresa_id,'pets.consultation.write')) with check (private.pets_tenant_allowed(empresa_id,'pets.consultation.write'));
create policy pets_core_delete on public.consultas_controles for delete to authenticated using (private.pets_tenant_allowed(empresa_id,'pets.consultation.write'));

-- Tabla eventos_mascota: lectura/escritura de la MISMA empresa del recurso.
drop policy if exists eventos_mascota_lectura_empresa on public.eventos_mascota;
drop policy if exists pets_core_read on public.eventos_mascota;
drop policy if exists pets_core_insert on public.eventos_mascota;
drop policy if exists pets_core_update on public.eventos_mascota;
drop policy if exists pets_core_delete on public.eventos_mascota;
drop policy if exists pets_core_event_read on public.eventos_mascota;
create policy pets_core_event_read on public.eventos_mascota for select to authenticated using (private.pets_tenant_allowed(empresa_id,'pets.consultation.read'));

-- Los clientes autenticados necesitan ver la empresa de una membresía PETS
-- activa aun si no coincide con public.usuarios.empresa_id legacy.
drop policy if exists empresas_pets_membresia on public.empresas;
create policy empresas_pets_membresia on public.empresas for select to authenticated
using (private.pets_tenant_allowed(id,'pets.pet.read'));

-- NO se cambia usuarios RLS todavía: allí existe empresa_id singular.
-- NO se tocan integraciones públicas ni service_role, que siempre requiere
-- autorización server-side ANTES de usarlo.
-- fin de 012_pets_multitenant_rls.sql: transacción global



-- ========= 013_core_sedes.sql =========
-- Core SaaS 013: sedes de empresa, grants y procedencia PETS.
-- Requiere 010+011+012. NO ejecutada; usar paquete de activacion auditado.
-- INVARIANTE UNI-001: sede NO es tenant; los maestros pertenecen a empresa.
-- inicio de 013_core_sedes.sql: transacción global

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
-- Registrar sedes nuevas desde Core Admin sin confiar en datos del cliente.
create or replace function public.core_crear_sede(
 p_actor_id uuid, p_empresa_id uuid, p_codigo text, p_nombre text
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_code text; v_name text; v_owner boolean;
begin
 v_code:=upper(btrim(coalesce(p_codigo,'')));
 v_name:=btrim(coalesce(p_nombre,''));
 if v_code !~ '^[A-Z0-9_-]{2,32}$'
 or char_length(v_name) not between 2 and 120
    or p_actor_id is null or p_empresa_id is null then
  raise exception 'DATOS_SEDE_INVALIDOS' using errcode='22023';
 end if;
 select exists(
  select 1 from core.platform_staff st join core.accounts a on a.user_id=st.user_id
  where st.user_id=p_actor_id and st.role='super_admin' and st.active and a.active
 ) into v_owner;
 if not exists(select 1 from public.empresas e where e.id=p_empresa_id and e.activa)
   or (
    not v_owner and not exists(
     select 1 from core.memberships m join core.accounts a on a.user_id=m.user_id
     where m.user_id=p_actor_id and m.empresa_id=p_empresa_id
       and m.status='active' and m.company_role='admin' and a.active
       and core.effective_permission(p_actor_id,p_empresa_id,'core.members.manage')
    )
   ) then raise exception 'SIN_PERMISO_PARA_CREAR_SEDE' using errcode='42501'; end if;
 insert into core.sedes(empresa_id,codigo,nombre,created_by)
 values(p_empresa_id,v_code,v_name,p_actor_id)
 returning id into v_id;
 insert into core.audit_events(empresa_id,actor_id,event_type,resource_id,metadata)
 values(p_empresa_id,p_actor_id,'core.sede.created',v_id::text,
 jsonb_build_object('code',v_code,'name',v_name));
 return v_id;
end;
$$;
revoke all on function public.core_crear_sede(uuid,uuid,text,text)
 from public,anon,authenticated;
grant execute on function public.core_crear_sede(uuid,uuid,text,text) to service_role;


-- El alcance del usuario distingue 'todas las sedes de su empresa'
-- de permisos restringidos a un subconjunto. Necesario para filtrar
-- historias clínicas sin permitir que el valor 'Todas' salte los grants.
create or replace function public.core_contexto_sedes(
 p_actor_id uuid,p_empresa_id uuid,p_permiso text
) returns jsonb language sql stable security definer set search_path=''
as $$
select case when core.effective_permission(p_actor_id,p_empresa_id,p_permiso)
then jsonb_build_object(
 'todas',(
  exists (
   select 1 from core.platform_staff st join core.accounts a on a.user_id=st.user_id
   where st.user_id=p_actor_id and st.role='super_admin' and st.active and a.active
  )
  or exists (
   select 1 from core.memberships m where m.user_id=p_actor_id
    and m.empresa_id=p_empresa_id and m.status='active' and m.sede_scope='all'
  )
  or exists (
   select 1 from core.platform_permission_grants gp
   join core.platform_staff st on st.user_id=gp.staff_user_id and st.active
   where gp.staff_user_id=p_actor_id and gp.empresa_id=p_empresa_id
    and gp.permission_code=p_permiso and st.role='super_user'
  )
 ),
 'sedes',coalesce((
  select jsonb_agg(jsonb_build_object('id',s.id,'nombre',s.nombre,'codigo',s.codigo)
      order by s.nombre)
   from core.sedes s where s.empresa_id=p_empresa_id and s.activa
    and core.site_allowed(p_actor_id,p_empresa_id,s.id,p_permiso)
 ),'[]'::jsonb))
else jsonb_build_object('todas',false,'sedes','[]'::jsonb) end;
$$;
revoke all on function public.core_contexto_sedes(uuid,uuid,text)
 from public,anon,authenticated;
grant execute on function public.core_contexto_sedes(uuid,uuid,text) to service_role;

-- fin de 013_core_sedes.sql: transacción global


-- Auditoría de bundle atómica con el resto de la migración:
create table if not exists core.migration_bundle_runs(
 bundle_code text primary key,
 installed_at timestamptz not null default now(),
 description text not null
);
alter table core.migration_bundle_runs enable row level security;
revoke all on core.migration_bundle_runs from public,anon,authenticated;
grant select,insert on core.migration_bundle_runs to service_role;

do $verify$
declare n_legacy bigint; n_mapped bigint;
begin
 if to_regclass('core.sedes') is null
 or to_regclass('core.membership_sedes') is null
 or to_regprocedure('public.core_pets_tenant_access(uuid,uuid,text)') is null
 or to_regprocedure('public.core_contexto_sedes(uuid,uuid,text)') is null
 or to_regprocedure('public.core_crear_sede(uuid,uuid,text,text)') is null then
  raise exception 'POSTCHECK_FALLO: RPCs o tablas Core incompletas';
 end if;
 select count(*) into n_legacy from public.usuarios where empresa_id is not null;
 select count(*) into n_mapped from public.usuarios u
 join core.memberships m on m.user_id=u.id and m.empresa_id=u.empresa_id
 where u.empresa_id is not null;
 if n_legacy<>n_mapped then
  raise exception 'POSTCHECK_MEMBERSHIPS % de %',n_mapped,n_legacy;
 end if;
 if exists(select 1 from public.mascotas m join core.sedes s on s.id=m.sede_origen_id
  where m.empresa_id<>s.empresa_id)
 or exists(select 1 from public.propietarios p join core.sedes s on s.id=p.sede_origen_id
  where p.empresa_id<>s.empresa_id) then
  raise exception 'POSTCHECK_CROSS_TENANT_SEDE';
 end if;
 insert into core.migration_bundle_runs(bundle_code,description)
 values('CORE_010_013','Core identidad, permisos, RLS PETS, sedes y mapeo conservador');
 raise notice 'CORE ESTRUCTURAL OK. Membresías migradas %/%; sedes creadas %',
 n_mapped,n_legacy,(select count(*) from core.sedes);
end;
$verify$;
commit;
-- ATENCIÓN: SQL ejecutado ≠ RLS ni aplicación validada.
-- CORE_PETS_MULTI_TENANT_READ_ENABLED debe continuar desactivado
-- hasta que la matriz de pruebas JWT/empresa/sede A/B esté aprobada.
