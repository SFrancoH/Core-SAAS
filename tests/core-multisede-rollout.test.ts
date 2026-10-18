import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(name:string)=>readFileSync(name,"utf8");

test("bundle Supabase integra cuatro migraciones en UNA transacción y deniega Core parcial",()=>{
 const sql=read("supabase/deploy/CORE_UNA_EJECUCION_STAGING.sql");
 assert.equal((sql.match(/^begin;$/gm)||[]).length,1);
 assert.equal((sql.match(/^commit;$/gm)||[]).length,1);
 for(const migration of ["010_core_access","011_core_identity_multitenant",
   "012_pets_multitenant_rls","013_core_sedes"]){
   assert.ok(sql.includes(migration+".sql"),migration);
 }
 assert.match(sql,/CORE_EXISTENTE_O_PARCIAL/);
 assert.match(sql,/PETS_001_009_INCOMPLETO/);
 assert.match(sql,/POSTCHECK_MEMBERSHIPS/);
 assert.match(sql,/core\.migration_bundle_runs/);
 assert.doesNotMatch(sql,/create table\s+(?:inventory|inventario)\./i);
});
test("PETS históricos preservan sede de origen sin inventar sede clínica",()=>{
 const sql=read("supabase/migrations/013_core_sedes.sql");
 assert.match(sql,/create table if not exists core\.sedes/);
 assert.match(sql,/create table if not exists core\.membership_sedes/);
 assert.match(sql,/create or replace function core\.site_allowed/);
 assert.match(sql,/create or replace function public\.core_contexto_sedes/);
 assert.match(sql,/create or replace function public\.core_crear_sede/);
 assert.match(sql,/alter table public\.consultas_controles\s+add column if not exists sede_id/);
 assert.match(sql,/upper\(btrim\(coalesce\(m\.fuente/);
 assert.doesNotMatch(sql,/set sede_id\s*=/);
 assert.match(sql,/core\.audit_events/);
});
test("lecturas/exportaciones tenant-scope no aceptan empresa desde body sin autorización",()=>{
 const files=[
 "app/api/core/empresas/[id]/pets/export/mascotas/route.ts",
 "app/api/core/empresas/[id]/pets/export/propietarios/route.ts",
 "app/portal/empresa/[id]/pets/mascotas/[petId]/historial/page.tsx"
 ];
 for(const path of files){
   const source=read(path);
   assert.match(source,/requirePetTenant\(/,path);
   assert.match(source,/\.eq\("empresa_id",/,path);
   assert.match(source,/ensureTenantRows\(/,path);
 }
 const history=read(files[2]);
 assert.match(history,/resolveSedeScope/);
 assert.match(history,/canSelectSede/);
 assert.match(history,/\.in\("sede_id",scope\.sedes/);
});
test("especificación Inventory permanece un documento de diseño, no se crea un sub-SaaS por sede",()=>{
 const md=read("docs/modules/INVENTORY_PLAN.md");
 for(const term of ["FEFO","FIFO","JIT","Cuarentena","Bodegas",
 "PULSE","PETS","altillaje","lote","stock","sede","I0","I9","NO"]) {
   assert.ok(md.toLowerCase().includes(term.toLowerCase()),term);
 }
 assert.match(md,/NO se implementan tablas/);
});
