import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql=readFileSync("supabase/migrations/011_core_identity_multitenant.sql","utf8");
test("migración 011 contiene funciones con delimitadores $$ balanceados",()=>{
  assert.doesNotMatch(sql,/^as \$$/gm);
  assert.doesNotMatch(sql,/^\$;$/gm);
  assert.equal((sql.match(/\$\$/g)||[]).length%2,0);
  assert.match(sql,/revoke all on function public\.core_assign_membership/);
});
test("RPC de permisos, membresías y asociación restringida; auditoría de creador",()=>{
  for(const name of ["core_register_account","core_assign_staff","core_assign_membership",
    "core_permission_catalog","core_company_members","core_find_account",
    "core_support_begin","core_support_end"]){
    assert.match(sql,new RegExp("function public\\."+name+"\\("),name);
  }
  assert.match(sql,/core\.audit_events/);
  assert.match(sql,/created_by/);
  assert.match(sql,/granted <>/);
  assert.match(sql,/service_role/);
});
test("interfaz de administración nunca es fuente de autorización",()=>{
  const actions=readFileSync("app/core-users/actions.ts","utf8");
  const portal=readFileSync("app/portal/page.tsx","utf8");
  assert.match(actions,/getCurrentProfile\(\)/);
  assert.match(actions,/core_autorizar_operacion/);
  assert.match(actions,/core_assign_membership/);
  assert.match(actions,/auth\.admin\.createUser/);
  assert.match(actions,/auth\.admin\.deleteUser/);
  assert.match(portal,/Pendiente aislamiento multiempresa/);
});
