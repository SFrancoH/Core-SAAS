import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const paths=[
  "app/core-users/actions.ts","app/empresa/actions.ts","app/login/actions.ts",
  "app/mascotas/[id]/actions.ts","app/mascotas/[id]/propietarios/nuevo/actions.ts",
  "app/mascotas/actions.ts","app/propietarios/[id]/actions.ts",
  "app/propietarios/actions.ts","app/registros/nuevo/actions.ts",
  "app/super-admin/actions.ts","app/super-admin/empresas/[id]/actions.ts"
];

test("Server Actions de escritura bloquean soporte, incluso con POST a otra URL",()=>{
  let inspected=0;
  for(const path of paths){
    const source=readFileSync(path,"utf8");
    const exported=[...source.matchAll(/export async function \w+\s*\(/g)].length;
    const guards=[...source.matchAll(/await assertNoSupportMode\(\);/g)].length;
    assert.ok(source.includes('from "@/lib/core/support-guard"'),path);
    assert.equal(guards,exported, path+" debe validar cada acción");
    inspected+=guards;
  }
  assert.ok(inspected>=15,"Cobertura de las acciones heredadas y Core");
});
