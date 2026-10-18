import Link from "next/link";
import { requireProfile } from "@/lib/core/auth";
import { getCompanyUserAdminData } from "@/lib/core/admin/user-management";
import { CoreCompanyUserForms, CompanyMembershipTable } from "@/components/core/user-forms";
import DashboardHeader from "@/components/dashboard-header";

export default async function CompanyCoreUsers({searchParams}:{searchParams:Promise<{error?:string;ok?:string}>}) {
  const actor=await requireProfile(["empresa_admin"]);
  const query=await searchParams;
  const data=await getCompanyUserAdminData();
  return <main className="dashboardShell">
    <DashboardHeader profile={actor} context={data.companyName} active="usuarios"/>
    <section className="dashboardContent wideContent">
      <Link href="/empresa">← Volver al panel</Link>
      <p className="eyebrow">Administración de empresa</p>
      <h1>Usuarios y permisos</h1>
      <p className="description">Puedes crear Admin y User solamente para tu empresa. No puedes crear Super-Users ni conceder privilegios que no poseas.</p>
      {query.ok?<div className="successAlert">Usuario creado con registro de auditoría.</div>:null}
      {query.error?<div className="formAlert">Operación rechazada. Comprueba el correo, la contraseña y los permisos.</div>:null}
      {!data.dbReady?<div className="formAlert">Gestión Core pendiente de instalación y validación de las migraciones 010 y 011.</div>:
        <>
          <CompanyMembershipTable members={data.members}/>
          <CoreCompanyUserForms companyId={data.companyId} permissions={data.permissions} owner={false}/>
        </>
      }
    </section>
  </main>;
}
