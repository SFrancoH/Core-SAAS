"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/core/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeCoreRole } from "@/lib/core/roles";
import { UUID_RE } from "@/lib/core/access";

function errPath(owner: boolean, companyId: string, status: string): string {
  const base = owner ? "/super-admin/usuarios" : "/empresa/usuarios";
  const company = owner && UUID_RE.test(companyId) ? "?empresa=" + encodeURIComponent(companyId) : "";
  return base + company + (company ? "&" : "?") + "error=" + status;
}
function okPath(owner: boolean, companyId: string, status: string): string {
  const base = owner ? "/super-admin/usuarios" : "/empresa/usuarios";
  const company = owner && UUID_RE.test(companyId) ? "?empresa=" + encodeURIComponent(companyId) : "";
  return base + company + (company ? "&" : "?") + "ok=" + status;
}
type Actor = { id: string; rol: string; empresa_id: string | null };
async function requireMemberManager(companyId: string, allowStaff: boolean): Promise<{ actor: Actor; owner: boolean }> {
  const actor = await getCurrentProfile();
  if (!actor) redirect("/login");
  const role = normalizeCoreRole(actor.rol);
  const owner = role === "super_admin";
  if (!owner && (role !== "admin" || actor.empresa_id !== companyId)) {
    redirect("/panel");
  }
  if (!owner && allowStaff) redirect("/panel");
  if (!UUID_RE.test(companyId)) redirect("/panel");
  const { data, error } = await getSupabaseAdmin().rpc("core_autorizar_operacion",{
    p_actor_id:actor.id,p_empresa_id:companyId,p_permiso:"core.members.manage",p_licencia:null
  });
  if (error || data !== true) redirect(errPath(owner,companyId,"sin_permiso"));
  return { actor, owner };
}

function validateInputs(form: FormData) {
  const companyId = String(form.get("empresa_id") ?? "");
  const nombre = String(form.get("nombre") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const role = String(form.get("rol") ?? "");
  const permissions = [...new Set(form.getAll("permisos").map(v=>String(v)))];
  return {companyId,nombre,email,password,role,permissions};
}

/** Crea identidad Auth una sola vez, la registra en Core y asigna membresía.
 * Si falla cualquier RPC, borra la identidad creada: no dejar login huérfano.
 * El servidor jamás concede roles con base solo en el formulario. */
export async function createCoreUser(form: FormData): Promise<void> {
  const input = validateInputs(form);
  const isStaff = input.role === "super_user";
  const current = await getCurrentProfile();
  if (!current) redirect("/login");
  const owner = normalizeCoreRole(current.rol) === "super_admin";
  if (isStaff && !owner) redirect("/panel");
  if (!isStaff) await requireMemberManager(input.companyId,false);
  if ((input.role !== "admin" && input.role !== "user" && !isStaff) ||
      input.nombre.length < 2 || input.nombre.length > 120 ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email) ||
      input.password.length < 12 ||
      (!isStaff && !UUID_RE.test(input.companyId))) {
    redirect(errPath(owner,input.companyId,"datos"));
  }
  const admin = getSupabaseAdmin();
  // Preflight: no crear usuario Auth si 011 no está instalada.
  const { error: preflightError } = await admin.rpc("core_identity", {p_actor_id:current.id});
  if (preflightError) redirect(errPath(owner,input.companyId,"sin_schema"));
  if (!isStaff) {
    const { data: access, error } = await admin.rpc("core_permission_catalog",{
      p_actor_id:current.id,p_empresa_id:input.companyId
    });
    const allowed = new Set(Array.isArray(access) ? access.map((p: {code?: string})=>p.code) : []);
    if (error || !allowed.has("core.members.manage") ||
      input.permissions.some(p=>!allowed.has(p))) redirect(errPath(owner,input.companyId,"permisos"));
    if (input.role==="admin" && !input.permissions.includes("core.members.manage")) {
      input.permissions.push("core.members.manage");
    }
    if (!input.permissions.length) redirect(errPath(owner,input.companyId,"permisos"));
  }
  const {data:created,error:createError} = await admin.auth.admin.createUser({
    email:input.email,password:input.password,email_confirm:true,
    user_metadata:{nombre:input.nombre}
  });
  if (createError || !created?.user) redirect(errPath(owner,input.companyId,"crear_auth"));
  let successful = false;
  try {
    const { data:registered,error:registerError } = await admin.rpc("core_register_account",{
      p_actor_id:current.id,p_user_id:created.user.id,p_nombre:input.nombre,
      p_email:input.email,p_platform_role:isStaff?"super_user":null,
      p_empresa_id:isStaff?null:input.companyId
    });
    if (registerError || registered!==true) throw new Error("REGISTER_FAILED");
    if (!isStaff) {
      const {data:membership,error:membershipError} = await admin.rpc("core_assign_membership",{
        p_actor_id:current.id,p_subject_id:created.user.id,
        p_empresa_id:input.companyId,p_role:input.role,p_permissions:input.permissions
      });
      if (membershipError || typeof membership !== "string") throw new Error("MEMBERSHIP_FAILED");
    }
    successful = true;
  } catch {
    // No presentar el error de una operación parcial como éxito.
  } finally {
    if (!successful) {
      const { error:cleanupError } = await admin.auth.admin.deleteUser(created.user.id);
      if (cleanupError) console.error("ERROR_CLEANUP_CORE_USER", {code:cleanupError.code});
    }
  }
  if (!successful) redirect(errPath(owner,input.companyId,"crear_core"));
  revalidatePath(owner?"/super-admin/usuarios":"/empresa/usuarios");
  redirect(okPath(owner,input.companyId,"creado"));
}

/** Solo Super-Admin puede asignar a otra empresa una cuenta ya existente.
 * No se fuerza a otros usuarios a una empresa desde un Admin local. */
export async function assignExistingCoreUser(form: FormData): Promise<void> {
  const actor = await getCurrentProfile();
  if (!actor || normalizeCoreRole(actor.rol)!=="super_admin") redirect("/panel");
  const companyId = String(form.get("empresa_id") ?? "");
  await requireMemberManager(companyId,false);
  const email = String(form.get("email_existente") ?? "").trim().toLowerCase();
  const role = String(form.get("rol_existente") ?? "");
  const permissions = [...new Set(form.getAll("permisos_existentes").map(String))];
  if (!email.includes("@") || !["admin","user"].includes(role) || !permissions.length) {
    redirect(errPath(true,companyId,"datos"));
  }
  const admin = getSupabaseAdmin();
  const {data:catalogue,error:catalogueError}=await admin.rpc("core_permission_catalog",{
    p_actor_id:actor.id,p_empresa_id:companyId
  });
  const allowed=new Set(Array.isArray(catalogue)?catalogue.map((p:{code?:string})=>p.code):[]);
  if (catalogueError || permissions.some(p=>!allowed.has(p))) redirect(errPath(true,companyId,"permisos"));
  if (role==="admin" && !permissions.includes("core.members.manage")) permissions.push("core.members.manage");
  const {data:subjectId,error:findError}=await admin.rpc("core_find_account",{
    p_actor_id:actor.id,p_email:email
  });
  if (findError || typeof subjectId!=="string" || !UUID_RE.test(subjectId)) {
    redirect(errPath(true,companyId,"no_encontrado"));
  }
  const {error}=await admin.rpc("core_assign_membership",{
    p_actor_id:actor.id,p_subject_id:subjectId,p_empresa_id:companyId,
    p_role:role,p_permissions:permissions
  });
  if (error) redirect(errPath(true,companyId,"asignacion"));
  revalidatePath("/super-admin/usuarios");
  redirect(okPath(true,companyId,"asignado"));
}
