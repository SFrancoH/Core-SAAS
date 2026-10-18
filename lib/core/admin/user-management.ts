import "server-only";
import { getCurrentProfile } from "@/lib/core/auth";
import { UUID_RE, CoreAccessError } from "@/lib/core/access";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeCoreRole } from "@/lib/core/roles";

type PermissionOption = { code: string; name: string; product: string | null; module: string | null };
type MemberRow = {
  user_id: string; name: string; email: string; role: "admin" | "user";
  active: boolean; created_by: string | null; permissions: string[];
};
type CompanyOption = { id: string; nombre: string };
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function isPermission(value: unknown): value is PermissionOption {
  return record(value) && typeof value.code === "string" &&
    typeof value.name === "string" &&
    (typeof value.product === "string" || value.product === null) &&
    (typeof value.module === "string" || value.module === null);
}
function isMember(value: unknown): value is MemberRow {
  return record(value) && UUID_RE.test(String(value.user_id || "")) &&
    typeof value.name === "string" && typeof value.email === "string" &&
    (value.role === "admin" || value.role === "user") &&
    typeof value.active === "boolean" && Array.isArray(value.permissions);
}
export async function getCompanyUserAdminData(
  requestedCompanyId?: string
): Promise<{ companyId: string; companyName: string; options: CompanyOption[];
  permissions: PermissionOption[]; members: MemberRow[]; actorRole: string; dbReady: boolean }> {
  const profile = await getCurrentProfile();
  if (!profile) throw new CoreAccessError("UNAUTHENTICATED");
  const role = normalizeCoreRole(profile.rol);
  const owner = role === "super_admin";
  const admin = role === "admin";
  if (!owner && !admin) throw new CoreAccessError("FORBIDDEN");
  const companyId = owner ? requestedCompanyId : profile.empresa_id;
  if (!companyId || !UUID_RE.test(companyId)) throw new CoreAccessError("INVALID_COMPANY");
  if (!owner && companyId !== profile.empresa_id) throw new CoreAccessError("FORBIDDEN");
  const client = getSupabaseAdmin();
  const [company, catalogue, members] = await Promise.all([
    client.from("empresas").select("id,nombre,activa").eq("id",companyId).maybeSingle(),
    client.rpc("core_permission_catalog",{p_actor_id:profile.id,p_empresa_id:companyId}),
    client.rpc("core_company_members",{p_actor_id:profile.id,p_empresa_id:companyId})
  ]);
  if (company.error || !company.data?.activa) throw new CoreAccessError("COMPANY_NOT_FOUND");
  const dbReady = !catalogue.error && !members.error;
  const permissions = dbReady && Array.isArray(catalogue.data)
    ? catalogue.data.filter(isPermission) : [];
  const rows = dbReady && Array.isArray(members.data)
    ? members.data.filter(isMember) : [];
  // El RPC deniega a usuarios sin autorización; un catálogo vacío no concede derecho.
  if (dbReady && !permissions.some(x=>x.code==="core.members.manage")) {
    throw new CoreAccessError("FORBIDDEN");
  }
  const companies = owner
    ? await client.from("empresas").select("id,nombre").eq("activa",true).order("nombre")
    : { data: [{id:companyId,nombre:company.data.nombre}],error:null };
  if (companies.error) throw new Error("No fue posible cargar el directorio de empresas");
  return {
    companyId, companyName: company.data.nombre,
    options: (companies.data ?? []) as CompanyOption[],
    permissions, members: rows, actorRole: role!, dbReady
  };
}
