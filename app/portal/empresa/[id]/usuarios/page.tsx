import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/core/auth";
import { getCompanyUserAdminData } from "@/lib/core/admin/user-management";
import { CoreCompanyUserForms, CompanyMembershipTable } from "@/components/core/user-forms";

export default async function WorkspaceUsers({
  params, searchParams
}: {params:Promise<{id:string}>;searchParams:Promise<{error?:string;ok?:string}>}) {
  const actor=await getCurrentProfile();
  if(!actor) redirect("/login");
  const {id}=await params;
  const q=await searchParams;
  const data=await getCompanyUserAdminData(id);
  return <main className="dashboardShell">
    <section className="dashboardContent wideContent">
      <Link href="/portal">← Mis empresas</Link>
      <p className="eyebrow">Core SaaS · {data.companyName}</p>
      <h1>Usuarios y permisos de empresa</h1>
      <p className="description">La empresa se verifica en Supabase. No puedes crear Super-Users ni conceder permisos fuera de los tuyos.</p>
      {q.ok?<div className="successAlert">Acceso registrado en la auditoría.</div>:null}
      {q.error?<div className="formAlert">No fue posible completar la operación.</div>:null}
      {!data.dbReady?<div className="formAlert">Requiere validar las migraciones Core 010 y 011.</div>:
      <>
        <CompanyMembershipTable members={data.members}/>
        <CoreCompanyUserForms companyId={data.companyId} permissions={data.permissions} owner={false} origin="portal"/>
      </>}
    </section>
  </main>;
}
