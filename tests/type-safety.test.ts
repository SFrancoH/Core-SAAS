import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["app", "components", "lib"];
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

test("ningún archivo TypeScript de aplicación puede desactivar el chequeo", () => {
  const checked = ROOTS.flatMap(files).filter(p => /\.tsx?$/.test(p)).concat("proxy.ts");
  const suppressed = checked.filter(p => {
    const source = readFileSync(p, "utf8");
    return /\/\/\s*@ts-(?:nocheck|ignore)|\/\*\s*@ts-(?:nocheck|ignore)/.test(source);
  });
  assert.deepEqual(suppressed, [], "No introducir @ts-nocheck ni @ts-ignore.");
  assert.ok(checked.length >= 50, "La cobertura incluye los módulos PETS y Core");
});
