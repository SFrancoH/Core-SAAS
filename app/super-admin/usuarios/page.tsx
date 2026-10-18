import Link from "next/link";
import { redirect } from "next/navigation";
import CoreAdminHeader from "@/components/layouts/core-admin-header";
import { CoreCompanyUserForms, CompanyMembershipTable, CoreStaffForm } from "@/components/core/user-forms";
import { requireProfile } from "@/lib/core/auth";
import { getCompanyUserAdminData } from "@/lib/core/admin/user-management";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type Query = { empresa?: string; error?: string; ok?: string };
export default async function CoreUsersPage({searchParams}: {searchParams:Promise<Query>}) {
  const actor = await requireProfile(["super_admin"]);
  const query = await searchParams;
  const admin = getSupabaseAdmin();
  const {data:allCompanies,error:companiesError}=await admin.from("empresas")
    .select("id,nombre,activa").eq("activa",true).order("nombre");
  if (companiesError) throw new Error("No fue posible listar las empresas");
  const companies=(allCompanies??[]) as {id:string;nombre:string}[];
  const companyId=companies.some(c=>c.id===query.empresa)?query.empresa:companies[0]?.id;
  if (!companyId) return <main className="dashboardShell coreAdminShell">
    <CoreAdminHeader profile={actor}/><section className="dashboardContent">
      <h1>Usuarios de Core SaaS</h1><p>No hay empresas activas. Crea una empresa primero.</p>
      <CoreStaffForm/>
    </section></main>;
  const data=await getCompanyUserAdminData(companyId);
  return <main className="dashboardShell coreAdminShell">
    <CoreAdminHeader profile={actor}/>
    <section className="dashboardContent wideContent coreAdminContent">
      <Link href="/super-admin">← Empresas</Link>
      <p className="eyebrow">Core Admin · Identidad global</p>
      <h1>Usuarios y permisos</h1>
      <p className="description">Control de acceso por empresa y vertical, no únicamente por interfaz. Cada acción comprueba membresía, permiso, licencia y empresa del recurso.</p>
      <form method="get" className="managementForm">
        <label>Empresa<select name="empresa" defaultValue={data.companyId}>
          {companies.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select></label>
        <button className="buttonSecondary" type="submit">Seleccionar</button>
      </form>
      {query.ok?<div className="successAlert">Operación registrada correctamente.</div>:null}
      {query.error?<div className="formAlert">Operación rechazada. Revisa permisos, datos y el estado de Core en Supabase.</div>:null}
      {!data.dbReady?<div className="formAlert">La gestión Core requiere ejecutar y validar las migraciones 010 y 011. La creación de usuarios está deshabilitada.</div>:
        <>
          <CompanyMembershipTable members={data.members}/>
          <CoreCompanyUserForms companyId={data.companyId} permissions={data.permissions} owner/>
        </>
      }
      <CoreStaffForm/>
    </section>
  </main>;
}
