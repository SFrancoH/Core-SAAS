import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string): string => readFileSync(path, "utf8");

test("UNI-001 es regla permanente en documentos maestros y verticales", () => {
  const required = [
    "AGENTS.md", "README.md", "PLAN_DESARROLLO.md",
    "docs/ARQUITECTURA.md", "docs/MODELO_DATOS_PERMISOS_LICENCIAS.md",
    "docs/COMO_AGREGAR_FUNCIONALIDAD.md",
    "docs/IDENTIDAD_ACCESO_MULTIEMPRESA.md",
    "docs/verticales/PETS.md", "docs/verticales/PULSE.md",
    "lib/modules/README.md"
  ];
  for (const path of required) {
    const text = read(path);
    assert.match(text, /UNI-001/, path);
  }
});
test("la norma separa maestro empresarial de operación por sede y rechaza duplicados", () => {
  const text=read("docs/UNIFICACION_MULTISEDE.md");
  for (const required of [
    "Una mascota = un registro maestro por empresa",
    "sede_id", "empresa_id", "no crea", "duplic",
    "Inventario", "Agenda", "PULSE", "PETS",
    "Permisos", "Pruebas obligatorias"
  ]) {
    assert.ok(text.toLowerCase().includes(required.toLowerCase()),required);
  }
  assert.match(text, /NO IMPLEMENTADO|NO DDL aplicado|NO APLICADO|no presentes/i);
});
test("el legado PETS revela sede como texto y conserva unicidad por empresa",()=>{
 const migration=read("supabase/migrations/005_fuente_sede.sql");
 const sql=read("supabase/migrations/001_saas_core.sql");
 const petCatalog=read("lib/verticals/pets/pet-catalogs.ts");
 assert.match(migration,/add column if not exists fuente text/);
 assert.match(sql,/mascotas_carnet_unico_por_empresa/);
 assert.match(sql,/propietarios_documento_unico_por_empresa/);
 assert.match(petCatalog,/SEDE NORTE/);
 assert.match(petCatalog,/SEDE SUR/);
});
