-- 011: IDENTIDAD GLOBAL Y MEMBRESÍAS MULTIEMPRESA - CORE SAAS
-- DEPENDE DE 010_core_access.sql; DISEÑO VERSIONADO, NO EJECUTADO.
-- Antes de aplicar: ejecutar PREFLIGHT_CORE.sql, confirmar backup/RLS y probar con 2 empresas.
-- No cambia ni elimina las columnas legacy PETS de public.usuarios en esta fase.
begin;
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
as $
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
$;
revoke all on function public.core_support_directory(uuid) from public,anon,authenticated;
grant execute on function public.core_support_directory(uuid) to service_role;

-- Vista efectiva del target (sin acceso a filas clínicas ni JWT del target).
create or replace function public.core_support_snapshot(p_actor_id uuid,p_session_id uuid)
returns jsonb language sql stable security definer set search_path=''
as $
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
$;
revoke all on function public.core_support_snapshot(uuid,uuid) from public,anon,authenticated;
grant execute on function public.core_support_snapshot(uuid,uuid) to service_role;


-- Registro de cuenta previamente invitada/creada en Supabase Auth.
-- Garantiza autoría inmutable y que correo/UUID existen realmente en Auth.
create or replace function public.core_register_account(
 p_actor_id uuid, p_user_id uuid, p_nombre text, p_email text
) returns boolean language plpgsql security definer set search_path=''
as $
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
$;
revoke all on function public.core_register_account(uuid,uuid,text,text)
 from public,anon,authenticated;
grant execute on function public.core_register_account(uuid,uuid,text,text) to service_role;

-- El propietario puede crear Super-Users, jamás un segundo Super-Admin.
create or replace function public.core_assign_staff(
 p_actor_id uuid,p_subject_id uuid,p_role text
) returns boolean language plpgsql security definer set search_path=''
as $
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
$;
revoke all on function public.core_assign_staff(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.core_assign_staff(uuid,uuid,text) to service_role;

-- Asociación a varias empresas en una sola transacción.
-- Cada item: { company_id, role: admin|user, permissions:[...] }.
create or replace function public.core_assign_multiple_memberships(
 p_actor_id uuid,p_subject_id uuid,p_assignments jsonb
) returns integer language plpgsql security definer set search_path=''
as $
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
$;
revoke all on function public.core_assign_multiple_memberships(uuid,uuid,jsonb)
 from public,anon,authenticated;
grant execute on function public.core_assign_multiple_memberships(uuid,uuid,jsonb)
 to service_role;


commit;
