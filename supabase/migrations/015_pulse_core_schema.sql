-- 015: PULSE dentro de Core SaaS, esquema NUEVO y AISLADO.
-- DEPENDE de Core 010-013; NO importar aquí los IDs TEXT de PULSE antiguo.
-- APLICACIÓN EXCLUSIVAMENTE MANUAL en Supabase Core STAGING tras backup y preflight.
-- Este archivo crea estructura VACÍA. No toca el proyecto Supabase de PULSE operativo.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $preflight$
begin
  if to_regclass('public.empresas') is null
    or to_regclass('core.memberships') is null
    or to_regclass('core.sedes') is null
    or to_regclass('core.entitlements') is null then
    raise exception 'CORE_010_013_REQUERIDO';
  end if;
  if exists (select 1 from pg_tables where schemaname='pulse') then
    raise exception 'PULSE_SCHEMA_YA_EXISTE: revisar antes de ejecutar 015';
  end if;
end;
$preflight$;

create schema if not exists pulse;
revoke all on schema pulse from public,anon,authenticated;
grant usage on schema pulse to service_role;

-- Los IDs reales del SaaS son UUID. legacy_project_id permite mapear la
-- identidad textual de PULSE original sin reutilizar sus PK ni tocar su DB.
create table pulse.proyectos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete restrict,
  legacy_project_id text,
  nombre text not null check (length(btrim(nombre)) between 2 and 180),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9_-]{1,119}$'),
  precio_boleta numeric(14,2) not null default 60000 check (precio_boleta>0),
  titulo_landing text,
  descripcion_landing text,
  imagen_principal_url text,
  formulario_compra_url text,
  flyer_url text,
  sorteos_config jsonb not null default '{}'::jsonb check(jsonb_typeof(sorteos_config)='object'),
  sales_token_hash text unique, -- hash SHA-256 o equivalente; jamás almacenar token en claro
  estado text not null default 'activo' check(estado in ('activo','inactivo','finalizado')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id,id),
  unique (empresa_id,slug),
  unique (empresa_id,legacy_project_id)
);
create index pulse_proyectos_company_state_idx on pulse.proyectos(empresa_id,estado,created_at desc);

-- Un grupo de números se reserva atómicamente por la futura RPC del dominio;
-- no se entiende confirmada por el mero INSERT de un registro de cabecera.
create table pulse.reservas (
  id uuid primary key default gen_random_uuid(), -- reserva_grupo
  empresa_id uuid not null,
  proyecto_id uuid not null,
  estado text not null default 'temporal' check (estado in ('temporal','confirmada','expirada','cancelada')),
  canal text not null check(length(btrim(canal)) between 2 and 80),
  vendedor_user_id uuid,
  sede_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  hold_token_hash text,
  expires_at timestamptz,
  confirmada_at timestamptz,
  created_at timestamptz not null default now(),
  unique(empresa_id,proyecto_id,id),
  foreign key (empresa_id,proyecto_id) references pulse.proyectos(empresa_id,id) on delete cascade,
  foreign key (empresa_id,vendedor_user_id) references core.memberships(empresa_id,user_id),
  foreign key (empresa_id,sede_id) references core.sedes(empresa_id,id),
  constraint reserva_confirmacion_consistente check (estado<>'confirmada' or confirmada_at is not null)
);
create index pulse_reservas_project_state_idx on pulse.reservas(empresa_id,proyecto_id,estado,created_at desc);

-- Se conservan estados operativos EXACTOS de PULSE original:
-- Disponible, No disponible, Debe, Abonado y Pagado.
-- Oficina = boleta sin vendedor asignado, NO otro usuario ni otro tenant.
create table pulse.boletas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  proyecto_id uuid not null,
  numero text not null check (numero ~ '^[0-9]{4}$'),
  estado text not null default 'Disponible'
    check(estado in ('Disponible','No disponible','Debe','Abonado','Pagado')),
  nombre_cliente text,
  telefono_cliente text,
  email_cliente text,
  ciudad_cliente text,
  valor_pagado numeric(14,2) not null default 0 check(valor_pagado>=0),
  comprobante_url text,
  vendedor_nombre text not null default 'Oficina',
  vendedor_user_id uuid,
  sede_id uuid,
  canal text,
  reserva_grupo uuid,
  reservado_hasta timestamptz,
  oportunidad_creada boolean not null default false,
  oportunidad_error_at timestamptz,
  pagado_en timestamptz, -- servidor lo asigna al marcar Pagado, nunca un webhook
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(empresa_id,proyecto_id,numero),
  unique(empresa_id,proyecto_id,id),
  foreign key (empresa_id,proyecto_id) references pulse.proyectos(empresa_id,id) on delete cascade,
  foreign key (empresa_id,proyecto_id,reserva_grupo)
    references pulse.reservas(empresa_id,proyecto_id,id) on delete set null (reserva_grupo),
  foreign key (empresa_id,vendedor_user_id) references core.memberships(empresa_id,user_id),
  foreign key (empresa_id,sede_id) references core.sedes(empresa_id,id),
  constraint pulse_boleta_saldo_valido check (estado<>'Disponible' or valor_pagado=0)
);
create index pulse_boletas_disponibilidad_idx
 on pulse.boletas(empresa_id,proyecto_id,estado,numero)
 where vendedor_user_id is null;
create index pulse_boletas_vendedor_idx
 on pulse.boletas(empresa_id,proyecto_id,vendedor_user_id,estado,numero);
create index pulse_boletas_grupo_idx
 on pulse.boletas(empresa_id,proyecto_id,reserva_grupo) where reserva_grupo is not null;

-- Asignaciones e historial de vendedores por empresa/proyecto; la fuente de
-- identidad es auth.users + core.memberships, NO public.admin_users de PULSE.
create table pulse.asignaciones_vendedores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  proyecto_id uuid not null,
  vendedor_user_id uuid not null,
  asignado_por_user_id uuid references auth.users(id) on delete set null,
  sede_id uuid,
  numero_desde text check(numero_desde ~ '^[0-9]{4}$'),
  numero_hasta text check(numero_hasta ~ '^[0-9]{4}$'),
  cantidad integer not null check(cantidad between 1 and 10000),
  created_at timestamptz not null default now(),
  foreign key (empresa_id,proyecto_id) references pulse.proyectos(empresa_id,id) on delete cascade,
  foreign key (empresa_id,vendedor_user_id) references core.memberships(empresa_id,user_id),
  foreign key (empresa_id,sede_id) references core.sedes(empresa_id,id)
);
create index pulse_asignaciones_vendedor_idx
 on pulse.asignaciones_vendedores(empresa_id,proyecto_id,vendedor_user_id,created_at desc);

-- Enlaces de vendedor con TOKEN HASHEADO y revocable, no URL en claro.
create table pulse.seller_sales_links (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  proyecto_id uuid not null,
  vendedor_user_id uuid not null,
  token_hash text not null unique,
  estado text not null default 'activo' check(estado in ('activo','revocado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id,proyecto_id,vendedor_user_id),
  foreign key (empresa_id,proyecto_id) references pulse.proyectos(empresa_id,id) on delete cascade,
  foreign key (empresa_id,vendedor_user_id) references core.memberships(empresa_id,user_id)
);

create table pulse.ganadores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  proyecto_id uuid not null,
  numero text not null check(numero ~ '^[0-9]{4}$'),
  fecha timestamptz not null,
  video_url text,
  poster_url text,
  activo boolean not null default true,
  orden integer not null default 0 check(orden>=0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (empresa_id,proyecto_id,numero)
    references pulse.boletas(empresa_id,proyecto_id,numero) on delete cascade
);
create index pulse_ganadores_publicos_idx
 on pulse.ganadores(empresa_id,proyecto_id,activo,orden,fecha desc);

-- Ledger monetario auditable. valor_pagado en boletas es un agregado:
-- webhooks que informan ACUMULADO deben REEMPLAZAR y no SUMAR.
create table pulse.movimientos_pago (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  proyecto_id uuid not null,
  boleta_id uuid not null,
  tipo text not null check(tipo in ('abono','pago','ajuste','reversion')),
  monto numeric(14,2) not null check(monto<>0),
  saldo_resultante numeric(14,2) not null check(saldo_resultante>=0),
  fuente text not null check(length(btrim(fuente)) between 2 and 50),
  evento_externo text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (empresa_id,proyecto_id,boleta_id)
    references pulse.boletas(empresa_id,proyecto_id,id) on delete restrict
);
create unique index pulse_movimiento_evento_unico_idx
 on pulse.movimientos_pago(empresa_id,fuente,evento_externo) where evento_externo is not null;
create index pulse_movimientos_boleta_idx
 on pulse.movimientos_pago(empresa_id,proyecto_id,boleta_id,created_at desc);

-- Una entrega de reserva por GRUPO, política one-shot sin reintentos automáticos.
-- Entrega HTTP exitosa NO implica que se creó oportunidad externa.
create table pulse.eventos_reserva (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  proyecto_id uuid not null,
  reserva_grupo uuid not null,
  estado text not null default 'pendiente'
    check(estado in ('pendiente','enviando','recibido','fallido','incierto')),
  intento_iniciado_at timestamptz,
  respuesta_at timestamptz,
  motivo text,
  created_at timestamptz not null default now(),
  unique (empresa_id,proyecto_id,reserva_grupo),
  foreign key (empresa_id,proyecto_id,reserva_grupo)
    references pulse.reservas(empresa_id,proyecto_id,id) on delete cascade
);
create index pulse_eventos_proyecto_idx
 on pulse.eventos_reserva(empresa_id,proyecto_id,created_at desc);

-- Una alerta por cada boleta/grupo que requiera creación manual de oportunidad.
create table pulse.alertas_oportunidades (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  proyecto_id uuid not null,
  boleta_id uuid not null,
  reserva_grupo uuid not null,
  responsable_user_id uuid,
  estado text not null default 'esperando'
    check(estado in ('esperando','pendiente','creada_manual','confirmada_automatica')),
  motivo text,
  created_at timestamptz not null default now(),
  resuelto_at timestamptz,
  resuelto_por_user_id uuid references auth.users(id) on delete set null,
  unique(boleta_id,reserva_grupo),
  foreign key (empresa_id,proyecto_id,boleta_id)
    references pulse.boletas(empresa_id,proyecto_id,id) on delete cascade,
  foreign key (empresa_id,proyecto_id,reserva_grupo)
    references pulse.reservas(empresa_id,proyecto_id,id) on delete cascade,
  foreign key (empresa_id,responsable_user_id)
    references core.memberships(empresa_id,user_id)
);
create index pulse_alertas_pendientes_idx
 on pulse.alertas_oportunidades(empresa_id,responsable_user_id,estado,created_at);

-- Timestamp del servidor: el cliente/webhook no puede suministrarlo.
-- Bloquear liberación de boletos pagados, abonados o con abonos; para corregir
-- un pago hace falta un flujo posterior explícito y auditable.
create function pulse.guardar_estado_pago()
returns trigger language plpgsql security invoker set search_path = ''
as $fn$
begin
  if tg_op='UPDATE' then
    if (old.estado in ('Pagado','Abonado') or old.valor_pagado>0)
      and new.estado='Disponible' then
      raise exception 'NO_SE_PUEDE_LIBERAR_BOLETA_CON_PAGO';
    end if;
    if old.estado='Pagado' and new.estado<>'Pagado' then
      raise exception 'PAGO_REQUIERE_REVERSO_AUDITADO';
    end if;
  end if;
  if new.estado='Pagado' and (tg_op='INSERT' or old.estado is distinct from 'Pagado') then
    new.pagado_en := clock_timestamp();
  elsif new.estado<>'Pagado' then
    new.pagado_en := null;
  elsif tg_op='UPDATE' then
    new.pagado_en := old.pagado_en;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$fn$;
revoke all on function pulse.guardar_estado_pago() from public,anon,authenticated;
create trigger pulse_boletas_pago_tg
before insert or update on pulse.boletas
for each row execute function pulse.guardar_estado_pago();

-- Core SaaS no expone acceso directo a las tablas PULSE; TODO acceso se
-- implementará en APIs/RPC que validen identidad real, permiso y licencia.
do $secure$
declare v_name text;
begin
  foreach v_name in array array[
    'proyectos','reservas','boletas','asignaciones_vendedores',
    'seller_sales_links','ganadores','movimientos_pago',
    'eventos_reserva','alertas_oportunidades'
  ] loop
    execute format('alter table pulse.%I enable row level security',v_name);
    execute format('revoke all on pulse.%I from public,anon,authenticated',v_name);
    execute format('grant select,insert,update,delete on pulse.%I to service_role',v_name);
  end loop;
end;
$secure$;
commit;

-- IMPORTANTE: ninguna tabla creada implica que la UI/API de PULSE funcione.
-- No habilitar PULSE a una empresa hasta implementar y probar operaciones.
