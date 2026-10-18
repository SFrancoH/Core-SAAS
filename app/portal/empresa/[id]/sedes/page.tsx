import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/core/auth";
import { resolveSedeScope } from "@/lib/core/sedes";
import { UUID_RE } from "@/lib/core/access";
import { crearSede } from "./actions";

export const dynamic="force-dynamic";
export default async function SedesEmpresa({params,searchParams}:{
  params:Promise<{id:string}>;searchParams:Promise<{error?:string;ok?:string}>
}){
  if(process.env.CORE_PETS_MULTI_TENANT_READ_ENABLED!=="true") notFound();
  const {id}=await params,q=await searchParams;
  if(!UUID_RE.test(id)) notFound();
  const actor=await getCurrentProfile();
  if(!actor) redirect("/login");
  let scope;
  try { scope=await resolveSedeScope(actor.id,id,"core.members.manage"); }
  catch {notFound();}
  // Sin la capacidad de gestionar la empresa no se puede ver su catálogo.
  // RPC nunca devuelve grants a quien no tenga permiso Core.
  if(!scope.todas && !scope.sedes.length) notFound();
  const base="/portal/empresa/"+id;
  return <main className="dashboardShell"><section className="dashboardContent wideContent">
    <Link href="/portal">← Mis empresas</Link>
    <p className="eyebrow">Core SaaS · Sedes empresariales</p>
    <h1>Administrar sedes</h1>
    <p className="description">Las sedes comparten empresa, identidad, mascotas, propietarios y verticales. Crear una sede no duplica datos ni genera una segunda cuenta.</p>
    {q.ok?<div className="successAlert">Sede registrada y auditada.</div>:null}
    {q.error?<div className="formAlert">No fue posible crear la sede. Revisa el código o tus permisos.</div>:null}
    <section className="coreSection">
      <h2>Sedes autorizadas</h2>
      <div className="userList">{scope.sedes.map(s=><div className="userRow" key={s.id}>
        <strong>{s.nombre}</strong><small>{s.codigo}</small>
      </div>)}</div>
      {!scope.sedes.length?<p>Sin sedes registradas.</p>:null}
    </section>
    <section className="managementSection">
      <h2>Crear sede</h2>
      <form action={crearSede} className="managementForm">
        <input type="hidden" name="empresa_id" value={id}/>
        <label>Código (único por empresa)<input name="codigo" placeholder="CENTRO" required minLength={2} maxLength={32}/></label>
        <label>Nombre de la sede<input name="nombre" placeholder="Sede Central" required minLength={2} maxLength={120}/></label>
        <button type="submit">Crear sede</button>
      </form>
    </section>
    <p><Link href={base+"/pets/mascotas"}>Ir a PETS de esta empresa →</Link></p>
  </section></main>;
}
