import test from "node:test";
import assert from "node:assert/strict";
import {
  CORE_ROLES, normalizeCoreRole, canCreateRole, authorizeMembership,
  canDelegatePermission, canStartSupportSession
} from "../lib/core/roles.ts";
import { isBlockedDuringSupport } from "../lib/core/support-policy.ts";

const actor = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const companyA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const companyB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("cuatro roles principales; cargos PETS se convierten solo para compatibilidad", () => {
  assert.equal(normalizeCoreRole("super_admin"), "super_admin");
  assert.equal(normalizeCoreRole("super_user"), "super_user");
  assert.equal(normalizeCoreRole("empresa_admin"), "admin");
  assert.equal(normalizeCoreRole("veterinario"), "user");
  assert.equal(normalizeCoreRole("vendedor"), null);
});

test("creación: propietario todos, empresa solo admin/user propio, super-user sin privilegios heredados", () => {
  assert.equal(canCreateRole(CORE_ROLES.SUPER_ADMIN,CORE_ROLES.SUPER_USER,false),true);
  assert.equal(canCreateRole(CORE_ROLES.ADMIN,CORE_ROLES.ADMIN,true),true);
  assert.equal(canCreateRole(CORE_ROLES.ADMIN,CORE_ROLES.USER,true),true);
  assert.equal(canCreateRole(CORE_ROLES.ADMIN,CORE_ROLES.USER,false),false);
  assert.equal(canCreateRole(CORE_ROLES.ADMIN,CORE_ROLES.SUPER_USER,true),false);
  assert.equal(canCreateRole(CORE_ROLES.SUPER_USER,CORE_ROLES.ADMIN,true),false);
  assert.equal(canCreateRole(CORE_ROLES.USER,CORE_ROLES.USER,true),false);
});

test("aislamiento: empresa, identidad, licencia y permiso deben coincidir simultáneamente", () => {
  const member = {
    userId: actor, companyId: companyA, role:"user" as const,
    active:true, companyActive:true,
    activeProducts:["PETS"], grantedPermissions:["pets.pet.read"]
  };
  assert.equal(authorizeMembership(member,actor,companyA,"PETS","pets.pet.read"),true);
  assert.equal(authorizeMembership(member,actor,companyB,"PETS","pets.pet.read"),false);
  assert.equal(authorizeMembership(member,other,companyA,"PETS","pets.pet.read"),false);
  assert.equal(authorizeMembership(member,actor,companyA,"PULSE","pulse.project.read"),false);
  assert.equal(authorizeMembership(member,actor,companyA,"PETS","pets.pet.write"),false);
  assert.equal(authorizeMembership({...member,active:false},actor,companyA,"PETS","pets.pet.read"),false);
  assert.equal(authorizeMembership({...member,companyActive:false},actor,companyA,"PETS","pets.pet.read"),false);
  assert.equal(canDelegatePermission(["pets.pet.read"],["pets.pet.read","pets.pet.write"]),false);
});

test("modo soporte: dueño real, tercero, motivo, restricción rutas y acciones", () => {
  assert.equal(canStartSupportSession(CORE_ROLES.SUPER_ADMIN,other,actor,"Revisar acceso de usuario"),true);
  assert.equal(canStartSupportSession(CORE_ROLES.SUPER_USER,other,actor,"Revisar acceso de usuario"),false);
  assert.equal(canStartSupportSession(CORE_ROLES.SUPER_ADMIN,actor,actor,"Revisar acceso de usuario"),false);
  assert.equal(canStartSupportSession(CORE_ROLES.SUPER_ADMIN,other,actor,"breve"),false);
  for (const path of ["/mascotas","/mascotas/123","/empresa","/api/registros/123/estado",
    "/super-admin","/super-admin/empresas/123","/propietarios/123","/registros/nuevo"]) {
    assert.equal(isBlockedDuringSupport(path),true,path);
  }
  for (const path of ["/super-admin/soporte","/login","/portal","/"]) {
    assert.equal(isBlockedDuringSupport(path),false,path);
  }
});
