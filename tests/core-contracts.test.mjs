import test from "node:test";
import assert from "node:assert/strict";
import { requireCompanyScope, assertResourceCompany, CoreAccessError } from "../lib/core/access.mjs";
import { normalizeGhlFields, pickGhlField } from "../lib/integrations/ghl-payload.mjs";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

test("usuario operativo usa su empresa", () => {
  assert.equal(requireCompanyScope({ activo: true, rol: "veterinario", empresa_id: A }, undefined), A);
  assert.throws(() => requireCompanyScope({ activo: true, rol: "veterinario", empresa_id: A }, B), CoreAccessError);
  assert.throws(() => requireCompanyScope({ activo: false, rol: "empresa_admin", empresa_id: A }, A), CoreAccessError);
});
test("superadministrador debe especificar empresa válida", () => {
  assert.equal(requireCompanyScope({ activo: true, rol: "super_admin", empresa_id: null }, A), A);
  assert.throws(() => requireCompanyScope({ activo: true, rol: "super_admin", empresa_id: null }, ""), CoreAccessError);
});
test("recurso siempre pertenece a empresa verificada", () => {
  assert.equal(assertResourceCompany(A, A), true);
  assert.throws(() => assertResourceCompany(A, B), CoreAccessError);
});
test("lector webhook acepta root, objetos anidados y prefijos", () => {
  assert.equal(pickGhlField({numero:"0001"}, "numero"), "0001");
  assert.equal(pickGhlField({customData:{numero:"0012"}}, "numero"), "0012");
  assert.equal(pickGhlField({custom_data:{numero:"0044"}}, "numero"), "0044");
  assert.equal(pickGhlField({custom_fields:{numero:"0088"}}, "numero"), "0088");
  assert.equal(pickGhlField({"customData.numero":"0099"}, "numero"), "0099");
  assert.equal(pickGhlField({data:{numero:"0021"}}, "numero"), "0021");
  assert.equal(pickGhlField({contact:{first_name:"Ana"}}, "nombre", "first_name"), "Ana");
});
test("prioridad raíz y mezcla: alias y valores conservados", () => {
  const data = normalizeGhlFields({empresa_id:A,customData:{proyecto_id:"P1",consecutivo_1:"0050"}}, {
    empresa_id:[],proyecto_id:[],numero:["consecutivo_1"]
  },{strict:["empresa_id","proyecto_id"]});
  assert.deepEqual(data,{values:{empresa_id:A,proyecto_id:"P1",numero:"0050"},conflicts:[]});
});
test("identificadores contradictorios se detectan sin autorización", () => {
  const data = normalizeGhlFields({empresa_id:A,custom_data:{empresa_id:B}}, {empresa_id:[]}, {strict:["empresa_id"]});
  assert.deepEqual(data.conflicts, ["empresa_id"]);
});
test("objetos anidados y nulos no producen valores espurios", () => {
  assert.equal(pickGhlField({customData:{numero:null}}, "numero"), "");
  assert.equal(pickGhlField({numero:{x:1}}, "numero"), "");
  assert.equal(pickGhlField(null,"numero"), "");
});
