import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {formatOfficeNumbers,isPulseTicketNumber,isOfficeTicketAvailable,canReleasePulseTicket}
 from "../lib/verticals/pulse/contracts.ts";

test("números PULSE conservan exactamente cuatro dígitos y ceros iniciales", () => {
  assert.equal(isPulseTicketNumber("0001"), true);
  assert.equal(isPulseTicketNumber("9999"), true);
  assert.equal(isPulseTicketNumber("0000"), true);
  assert.equal(isPulseTicketNumber("123"), false);
  assert.equal(isPulseTicketNumber(1), false);
});

test("150 números: texto plano, coma y | cada 50, no JSON ni delimitador final", () => {
  const numbers=Array.from({length:150},(_,i)=>String(i).padStart(4,"0"));
  const output=formatOfficeNumbers(numbers);
  const groups=output.split(" | ");
  assert.equal(groups.length,3);
  assert.equal(groups[0].split(", ").length,50);
  assert.equal(groups[1].split(", ").length,50);
  assert.equal(groups[2].split(", ").length,50);
  assert.equal(output.startsWith("0000, 0001"),true);
  assert.equal(output.endsWith("0149"),true);
  assert.equal(formatOfficeNumbers([]),"");
  assert.equal(formatOfficeNumbers(["0021","0032"]),"0021, 0032");
  assert.throws(()=>formatOfficeNumbers([...numbers,"0150"]),RangeError);
  assert.throws(()=>formatOfficeNumbers(["1"]),TypeError);
  assert.throws(()=>formatOfficeNumbers(["0001","0001"]),/DUPLICATE/);
});

test("oficina no lista un número reservado, abonado ni asignado a vendedor", () => {
  const base={numero:"0001",estado:"Disponible" as const,vendedor_user_id:null,
    vendedor_nombre:"Oficina",valor_pagado:0,reserva_grupo:null};
  assert.equal(isOfficeTicketAvailable(base),true);
  assert.equal(isOfficeTicketAvailable({...base,vendedor_user_id:"seller"}),false);
  assert.equal(isOfficeTicketAvailable({...base,valor_pagado:1000}),false);
  assert.equal(isOfficeTicketAvailable({...base,reserva_grupo:"hold"}),false);
  assert.equal(isOfficeTicketAvailable({...base,estado:"Abonado"}),false);
  assert.equal(canReleasePulseTicket("Pagado",0,null),false);
  assert.equal(canReleasePulseTicket("Abonado",0,null),false);
  assert.equal(canReleasePulseTicket("Debe",5000,null),false);
  assert.equal(canReleasePulseTicket("Disponible",0,null),true);
});

test("DDL de PULSE no toca tablas operativas actuales ni elimina entidades", () => {
  const sql=readFileSync("supabase/migrations/015_pulse_core_schema.sql","utf8");
  for (const table of ["proyectos","reservas","boletas","asignaciones_vendedores",
      "seller_sales_links","ganadores","movimientos_pago","eventos_reserva",
      "alertas_oportunidades"]) {
    assert.match(sql,new RegExp("create table pulse\\."+table+"\\s*\\(","i"));
  }
  assert.match(sql,/references public\.empresas\(id\)/i);
  assert.match(sql,/references core\.memberships\(empresa_id,user_id\)/i);
  assert.match(sql,/references core\.sedes\(empresa_id,id\)/i);
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke all on pulse\.%I from public,anon,authenticated/i);
  assert.match(sql,/pagado_en := clock_timestamp\(\)/i);
  assert.doesNotMatch(sql,/\b(drop table|truncate table|alter table public\.boletas)\b/i);
});

test("RPC Core de licencias exige propietario y audita cambios", () => {
  const sql=readFileSync("supabase/migrations/014_core_license_admin.sql","utf8");
  assert.match(sql,/create or replace function public\.core_company_entitlements/i);
  assert.match(sql,/create or replace function public\.core_set_product_entitlement/i);
  assert.match(sql,/s\.role='super_admin' and s\.active/i);
  assert.match(sql,/insert into core\.audit_events/i);
  assert.match(sql,/revoke all on function public\.core_set_product_entitlement/i);
});
