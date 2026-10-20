import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validPetTenantInput, ensureTenantRows, normalizePetPage } from "../lib/verticals/pets/tenant-policy.ts";

const a="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const b="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
test("solicitud de tenant requiere UUID y permiso PETS reconocido",()=>{
 assert.equal(validPetTenantInput(a,"pets.pet.read"),true);
 assert.equal(validPetTenantInput(a,"pulse.project.read"),false);
 assert.equal(validPetTenantInput("../other","pets.pet.read"),false);
 assert.equal(validPetTenantInput("","pets.pet.write"),false);
});
test("consulta service_role rechaza filas mezcladas de tenants",()=>{
 const own={id:"1",empresa_id:a};
 assert.deepEqual(ensureTenantRows([own],a),[own]);
 assert.throws(()=>ensureTenantRows([own,{id:"2",empresa_id:b}],a),/CROSS_TENANT/);
 assert.throws(()=>ensureTenantRows([own],b),/CROSS_TENANT/);
 assert.throws(()=>ensureTenantRows([], "invalid"),/CROSS_TENANT/);
});
test("paginación normalizada no permite negativos, NaN o páginas gigantes",()=>{
 assert.equal(normalizePetPage("-1"),1);
 assert.equal(normalizePetPage("NaN"),1);
 assert.equal(normalizePetPage("10000000000"),100000);
 assert.equal(normalizePetPage("3"),3);
});
test("PETS multiempresa exige RPC y filtro tenant para cada lectura service_role",()=>{
 const context=readFileSync("lib/verticals/pets/tenant-context.ts","utf8");
 assert.match(context,/CORE_PETS_MULTI_TENANT_READ_ENABLED/);
 assert.match(context,/core_pets_tenant_access/);
 assert.match(context,/getCurrentProfile\(\)/);
 assert.match(context,/allowed !== true/);
 for(const path of [
 "app/portal/empresa/[id]/pets/mascotas/page.tsx",
 "app/portal/empresa/[id]/pets/propietarios/page.tsx",
 "app/portal/empresa/[id]/pets/mascotas/[petId]/page.tsx"
 ]) {
   const page=readFileSync(path,"utf8");
   assert.match(page,/requirePetTenant\(/,path);
   assert.match(page,/\.eq\("empresa_id",/,path);
   assert.match(page,/ensureTenantRows\(/,path);
 }
});
test("RLS nueva no amplía permisos mediante política heredada permisiva",()=>{
 const sql=readFileSync("supabase/migrations/012_pets_multitenant_rls.sql","utf8");
 assert.match(sql,/core\.effective_permission\(auth\.uid\(\),p_empresa_id,p_permission\)/);
 assert.match(sql,/core\.entitlements/);
 assert.match(sql,/UNEXPECTED_RLS_POLICY/);
 assert.match(sql,/drop policy if exists mascotas_lectura_por_empresa/);
 assert.match(sql,/drop policy if exists consultas_controles_lectura_por_empresa/);
 assert.match(sql,/drop policy if exists eventos_mascota_lectura_empresa/);
 assert.match(sql,/revoke all on function public\.core_pets_tenant_access/);
 assert.match(sql,/grant execute on function public\.core_pets_tenant_access\(uuid,uuid,text\) to service_role/);
});

test("C14: exportaciones antiguas delegan a rutas Core con autorización explícita",()=>{
 for(const resource of ["mascotas","propietarios"]){
  const old=readFileSync(`app/api/export/${resource}/route.ts`,"utf8");
  assert.match(old,/getCurrentProfile\(\)/);
  assert.match(old,/\/api\/core\/empresas\//);
  assert.doesNotMatch(old,/\.from\("mascotas"\)|\.from\("propietarios"\)/);
  const scoped=readFileSync(`app\/api\/core\/empresas\/[id]\/pets\/export\/${resource}\/route.ts`,"utf8");
  assert.match(scoped,/requirePetTenant\(/);
  assert.match(scoped,/resolveSedeScope\(/);
  assert.match(scoped,/\.eq\("empresa_id",tenant\.companyId\)/);
  assert.match(scoped,/\.in\("sede_origen_id"/);
 }
});
test("C14: listados y detalle limitan las sedes en servidor",()=>{
 for(const path of [
 "app/portal/empresa/[id]/pets/mascotas/page.tsx",
 "app/portal/empresa/[id]/pets/propietarios/page.tsx",
 "app/portal/empresa/[id]/pets/mascotas/[petId]/page.tsx"
 ]){
  const code=readFileSync(path,"utf8");
  assert.match(code,/requirePetTenant\(/);
  assert.match(code,/resolveSedeScope\(/);
  assert.match(code,/\.in\("sede_origen_id"/);
 }
});
