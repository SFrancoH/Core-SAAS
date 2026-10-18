import CoreAdminHeader from "@/components/layouts/core-admin-header";
import { requireProfile } from "@/lib/core/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { SUPPORT_COOKIE } from "@/lib/core/support-policy";
import { UUID_RE } from "@/lib/core/access";
import { beginSupportView, endSupportView } from "./actions";

type DirectoryItem = {
  subject_id: string; subject_name: string; subject_email: string;
  company_id: string; company_name: string; role: string;
};
type Snapshot = {
  subject_id: string; subject_name: string; company_id: string;
  company_name: string; company_role: string;
  permissions: string[]; products: string[];
};
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
function parseDirectory(x: unknown): DirectoryItem[] {
  if (!Array.isArray(x)) return [];
  return x.filter((v): v is DirectoryItem => isRecord(v) &&
    typeof v.subject_id === "string" && typeof v.subject_name === "string" &&
    typeof v.subject_email === "string" && typeof v.company_id === "string" &&
    typeof v.company_name === "string" && typeof v.role === "string");
}
function parseSnapshot(x: unknown): Snapshot | null {
  if (!isRecord(x) || typeof x.subject_id !== "string" ||
    typeof x.subject_name !== "string" || typeof x.company_id !== "string" ||
    typeof x.company_name !== "string" || typeof x.company_role !== "string") return null;
  return {
    subject_id: x.subject_id, subject_name: x.subject_name,
    company_id: x.company_id, company_name: x.company_name,
    company_role: x.company_role,
    permissions: Array.isArray(x.permissions) ? x.permissions.filter((v): v is string => typeof v === "string") : [],
    products: Array.isArray(x.products) ? x.products.filter((v): v is string => typeof v === "string") : []
  };
}

export default async function SupportPage({ searchParams }: {
  searchParams: Promise<{ error?: string }>
}) {
  const actor = await requireProfile(["super_admin"]);
  const params = await searchParams;
  const sessionId = (await cookies()).get(SUPPORT_COOKIE)?.value;
  const admin = getSupabaseAdmin();
  const active = sessionId && UUID_RE.test(sessionId)
    ? await admin.rpc("core_support_snapshot", { p_actor_id: actor.id, p_session_id: sessionId })
    : null;
  const snapshot = parseSnapshot(active?.data);
  const { data: directoryData, error: directoryError } = !sessionId
    ? await admin.rpc("core_support_directory", { p_actor_id: actor.id })
    : { data: null, error: null };
  const directory = parseDirectory(directoryData);
  return <main className="dashboardShell coreAdminShell">
    <CoreAdminHeader profile={actor} active="empresas" />
    <section className="dashboardContent wideContent coreAdminContent">
      <p className="eyebrow">Core Admin · Sesiones de soporte</p>
      <h1>Ver como usuario</h1>
      <p className="description">Acceso de diagnóstico de solo lectura: no inicia sesión con la identidad del usuario, no conoce su contraseña y no permite abrir formularios ni efectuar operaciones. La sesión queda auditada y caduca en 15 minutos.</p>
      {sessionId ? <section className="coreSection">
        {snapshot ? <>
          <div className="successAlert">Modo soporte activo · Solo lectura · Actor real: {actor.nombre}</div>
          <h2>{snapshot.subject_name}</h2>
          <p>Empresa: <strong>{snapshot.company_name}</strong> · Rol: <strong>{snapshot.company_role}</strong></p>
          <p className="eyebrow">Verticales habilitadas</p>
          <p>{snapshot.products.length ? snapshot.products.join(", ") : "Ninguna"}</p>
          <p className="eyebrow">Permisos efectivos</p>
          <ul>{snapshot.permissions.map(permission => <li key={permission}>{permission}</li>)}</ul>
        </> : <div className="formAlert">La sesión expiró o no puede verificarse. Sal del modo soporte.</div>}
        <form action={endSupportView}><button type="submit" className="buttonSecondary">Salir del modo soporte</button></form>
      </section> : directoryError ? <div className="formAlert">
        El modo soporte requiere la migración 011 y sus permisos de base de datos. Está bloqueado hasta que se instalen y verifiquen.
      </div> : <section className="coreSection">
        <div className="coreSectionHeading"><h2>Nueva vista de soporte</h2></div>
        {params.error ? <div className="formAlert">No fue posible iniciar el modo soporte. Revisa los permisos, la empresa y el motivo.</div> : null}
        <form action={beginSupportView} className="managementForm">
          <label>Usuario y empresa
            <select required name="destino" defaultValue="">
              <option value="" disabled>Selecciona un usuario</option>
              {directory.map(item => <option key={item.subject_id + item.company_id} value={item.subject_id + "|" + item.company_id}>
                {item.subject_name} · {item.company_name} · {item.role}
              </option>)}
            </select>
          </label>
          <label>Motivo de soporte (mínimo 10 caracteres)
            <textarea name="motivo" minLength={10} maxLength={500} required rows={3}
              placeholder="Describe el problema que se va a diagnosticar" />
          </label>
          <button type="submit" disabled={!directory.length}>Iniciar vista de solo lectura</button>
        </form>
      </section>}
    </section>
  </main>;
}
