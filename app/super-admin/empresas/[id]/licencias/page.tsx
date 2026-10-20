import Link from "next/link";
import { notFound } from "next/navigation";
import CoreAdminHeader from "@/components/layouts/core-admin-header";
import { requireProfile } from "@/lib/core/auth";
import { UUID_RE } from "@/lib/core/access";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { saveCompanyLicense } from "./actions";

type LicenseRow = {
  product_code: string; product_name: string; product_active: boolean;
  status: "active" | "suspended" | "expired" | null;
  valid_from: string | null; valid_until: string | null; effective: boolean;
};
type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
};

export default async function CompanyLicensesPage({ params, searchParams }: Props) {
  const actor = await requireProfile(["super_admin"]);
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const query = await searchParams;
  const admin = getSupabaseAdmin();
  const [{ data: company, error: companyError }, { data, error }] = await Promise.all([
    admin.from("empresas").select("id,nombre").eq("id",id).maybeSingle(),
    admin.rpc("core_company_entitlements", { p_actor_id: actor.id,p_empresa_id:id })
  ]);
  if (companyError || !company) notFound();
  const licenses: LicenseRow[] = Array.isArray(data)
    ? data.filter((item: unknown): item is LicenseRow =>
        !!item && typeof item === "object" &&
        typeof (item as LicenseRow).product_code === "string" &&
        typeof (item as LicenseRow).product_name === "string")
    : [];

  return <main className="dashboardShell coreAdminShell">
    <CoreAdminHeader profile={actor} active="empresas" />
    <section className="dashboardContent wideContent">
      <Link className="backLink" href={"/super-admin/empresas/"+id}>← Volver a {company.nombre}</Link>
      <p className="eyebrow">CORE ADMIN · Licenciamiento central</p>
      <h1>Licencias de {company.nombre}</h1>
      <p className="description">Las licencias se asignan por empresa y producto. No crean permisos de usuario por sí mismas. Cada operación debe seguir validando membresía, permiso y licencia vigente.</p>
      {query.ok && <div className="successAlert">Licencia actualizada y auditada.</div>}
      {query.error && <div className="formAlert">No se pudo guardar la licencia. Revisa los datos y la migración 014.</div>}
      {error && <div className="formAlert">La consulta central de licencias no está disponible. Instala las migraciones 010, 011 y 014 en Supabase de pruebas antes de utilizar esta pantalla.</div>}
      {!error && !licenses.length && <div className="emptyState">Sin productos disponibles en el catálogo.</div>}
      {!error && <div className="userList">
        {licenses.map(license => <article className="userRow" key={license.product_code}>
          <div className="userIdentity">
            <strong>{license.product_name} ({license.product_code})</strong>
            <span>{license.effective ? "Licencia vigente" : license.status === "suspended"
              ? "Suspendida" : license.status === "active" ? "Vencida" : "Sin licencia"}</span>
            <small>{license.valid_until ? "Hasta: " + license.valid_until.slice(0,10) + " (UTC)" : "Sin vencimiento"}</small>
          </div>
          <form action={saveCompanyLicense} className="smallActionForm">
            <input type="hidden" name="empresa_id" value={id} />
            <input type="hidden" name="producto" value={license.product_code} />
            <label>Estado
              <select name="estado" defaultValue={license.status === "active" ? "active" : "suspended"}>
                <option value="active">Activa</option>
                <option value="suspended">Suspendida</option>
              </select>
            </label>
            <label>Vencimiento (opcional, UTC)
              <input type="date" name="vence" defaultValue={license.valid_until?.slice(0,10) ?? ""} />
            </label>
            <button type="submit" disabled={!license.product_active}>Guardar licencia</button>
          </form>
        </article>)}
      </div>}
    </section>
  </main>;
}
