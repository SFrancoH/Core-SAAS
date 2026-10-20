-- 014: administración de licencias Core desde el propietario global.
-- DEPENDE de 010 y 011. SQL manual; NO ejecutado por este commit.
-- No modifica licencias existentes hasta que se use explícitamente el formulario.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regclass('core.entitlements') is null
    or to_regclass('core.platform_staff') is null
    or to_regclass('core.accounts') is null
    or to_regclass('core.products') is null
    or to_regclass('core.audit_events') is null then
    raise exception 'CORE_010_011_REQUERIDO';
  end if;
end;
$preflight$;

-- La identidad p_actor_id llega EXCLUSIVAMENTE de la sesión verificada
-- en el servidor. La función es invocable solo con service_role.
create or replace function public.core_company_entitlements(
  p_actor_id uuid, p_empresa_id uuid
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $fn$
declare v_result jsonb;
begin
  if not exists (
    select 1 from core.platform_staff s
    join core.accounts a on a.user_id=s.user_id and a.active
    where s.user_id=p_actor_id and s.role='super_admin' and s.active
  ) then
    raise exception 'PERMISSION_DENIED' using errcode='42501';
  end if;
  if not exists(select 1 from public.empresas where id=p_empresa_id) then
    raise exception 'COMPANY_NOT_FOUND' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'product_code',p.code,'product_name',p.name,'product_active',p.active,
      'status',e.status,'valid_from',e.valid_from,'valid_until',e.valid_until,
      'effective',coalesce(e.status='active' and e.valid_from<=now()
        and (e.valid_until is null or e.valid_until>now()),false)
    ) order by p.code
  ), '[]'::jsonb) into v_result
  from core.products p
  left join core.entitlements e
    on e.product_code=p.code and e.empresa_id=p_empresa_id;
  return v_result;
end;
$fn$;
revoke all on function public.core_company_entitlements(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.core_company_entitlements(uuid,uuid) to service_role;

-- Upsert de una licencia de producto: la operación no toca el resto de productos,
-- no concede membresías ni ignora la fecha límite.
create or replace function public.core_set_product_entitlement(
  p_actor_id uuid,
  p_empresa_id uuid,
  p_product_code text,
  p_status text,
  p_valid_until timestamptz default null
) returns boolean
language plpgsql volatile security definer set search_path = ''
as $fn$
declare v_old jsonb;
begin
  if not exists (
    select 1 from core.platform_staff s
    join core.accounts a on a.user_id=s.user_id and a.active
    where s.user_id=p_actor_id and s.role='super_admin' and s.active
  ) then
    raise exception 'PERMISSION_DENIED' using errcode='42501';
  end if;
  if not exists(select 1 from public.empresas where id=p_empresa_id) then
    raise exception 'COMPANY_NOT_FOUND' using errcode='22023';
  end if;
  if not exists(select 1 from core.products where code=p_product_code and active) then
    raise exception 'INVALID_PRODUCT' using errcode='22023';
  end if;
  if p_status not in ('active','suspended')
    or (p_valid_until is not null and p_valid_until<=now()) then
    raise exception 'INVALID_LICENSE' using errcode='22023';
  end if;

  select jsonb_build_object('status',status,'valid_until',valid_until)
  into v_old from core.entitlements
  where empresa_id=p_empresa_id and product_code=p_product_code for update;

  insert into core.entitlements(empresa_id,product_code,status,valid_from,valid_until)
  values(p_empresa_id,p_product_code,p_status,now(),p_valid_until)
  on conflict (empresa_id, product_code) where product_code is not null
  do update set status=excluded.status,
    valid_from=excluded.valid_from,valid_until=excluded.valid_until,
    updated_at=now();

  insert into core.audit_events(empresa_id,actor_id,event_type,resource_id,metadata)
  values (p_empresa_id,p_actor_id,'core.entitlement.updated',p_product_code,
    jsonb_build_object('previous',v_old,'status',p_status,'valid_until',p_valid_until));
  return true;
end;
$fn$;
revoke all on function public.core_set_product_entitlement(uuid,uuid,text,text,timestamptz)
  from public,anon,authenticated;
grant execute on function public.core_set_product_entitlement(uuid,uuid,text,text,timestamptz)
  to service_role;
commit;