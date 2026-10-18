-- 012 · PETS: RLS por membresía multiempresa y licencia activa
-- REQUIERE migraciones 001-011 instaladas y verificadas sobre Supabase CORE.
-- NO APLICAR a producción sin backup restaurable y E2E A/B en staging.
-- El backend deberá usar un tenant explícito en cada consulta y guard de permiso.
-- Esta migración NO despliega rutas, no altera datos clínicos ni ejecuta GRANT indiscriminado.
begin;

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
commit;
