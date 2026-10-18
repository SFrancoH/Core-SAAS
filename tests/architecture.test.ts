import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function visit(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap(item => {
    const path = join(root, item.name);
    return item.isDirectory() ? visit(path) : [path];
  });
}

test("la aplicación PETS y Core usan archivos TypeScript", () => {
  const roots = ["app", "components", "lib"];
  const legacy = roots.flatMap(visit).filter(path => /\.(js|jsx|mjs)$/.test(path));
  assert.deepEqual(legacy, []);
  assert.equal(statSync("proxy.ts").isFile(), true);
});

test("el frontend consume una paleta semántica única", () => {
  const tokens = readFileSync("styles/tokens.css", "utf8");
  const globals = readFileSync("app/globals.css", "utf8");
  const shell = readFileSync("styles/shell.css", "utf8");
  assert.match(tokens, /--color-primary:\s*#[a-f0-9]{6}/i);
  assert.match(tokens, /--color-surface:\s*#[a-f0-9]{6}/i);
  assert.match(globals, /var\(--color-/);
  assert.match(shell, /var\(--color-/);
  assert.doesNotMatch(globals + shell, /#[a-f0-9]{3,8}\b/i);
  assert.doesNotMatch(globals + shell, /rgba?\([^)]+\)/i);
});

test("Core Admin y la vista de apariencia están en la estructura", () => {
  assert.equal(statSync("app/super-admin/page.tsx").isFile(), true);
  assert.equal(statSync("app/super-admin/apariencia/page.tsx").isFile(), true);
  assert.equal(statSync("lib/core/admin/overview.ts").isFile(), true);
  assert.equal(statSync("components/layouts/core-admin-header.tsx").isFile(), true);
});

test("los módulos PETS/PULSE tienen carpetas separadas", () => {
  assert.equal(statSync("lib/verticals/pets").isDirectory(), true);
  assert.equal(statSync("lib/verticals/pulse").isDirectory(), true);
  assert.equal(statSync("lib/modules").isDirectory(), true);
  assert.equal(statSync("lib/integrations").isDirectory(), true);
});
