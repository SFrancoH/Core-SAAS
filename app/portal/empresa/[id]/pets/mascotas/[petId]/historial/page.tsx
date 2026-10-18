import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requirePetTenant } from "@/lib/verticals/pets/tenant-context";
import { ensureTenantRows,normalizePetPage } from "@/lib/verticals/pets/tenant-policy";
import { resolveSedeScope,canSelectSede } from "@/lib/core/sedes";
import { UUID_RE } from "@/lib/core/access";

export const dynamic="force-dynamic";
type Consulta={ id:string;empresa_id:string;mascota_id:string;
  fecha_registro:string;tipo_servicio:string|null;
  motivo_cita:string|null;diagnostico_definitivo:string|null;sede_id:string|null };
type Query={sede?:string;page?:string};
export default async function HistorialPorEmpresa({params,searchParams}:{
 params:Promise<{id:string;petId:string}>;searchParams:Promise<Query>
}){
 const {id,petId}=await params;
 const ctx=await requirePetTenant(id,"pets.consultation.read");
 if(!UUID_RE.test(petId))notFound();
 const q=await searchParams;
 const page=normalizePetPage(q.page);
 const scope=await resolveSedeScope(ctx.actorId,id,"pets.consultation.read");
 const selected=q.sede??"todas";
 if(!canSelectSede(scope,selected))notFound();
 const {data:pet,error:petError}=await getSupabaseAdmin().from("mascotas")
  .select("id,nombre,empresa_id").eq("empresa_id",ctx.companyId)
  .eq("id",petId).maybeSingle();
 if(petError||!pet)notFound();
 ensureTenantRows([pet],ctx.companyId);
 let request=getSupabaseAdmin().from("consultas_controles")
  .select("id,empresa_id,mascota_id,fecha_registro,tipo_servicio,motivo_cita,diagnostico_definitivo,sede_id",{count:"exact"})
  .eq("empresa_id",ctx.companyId).eq("mascota_id",petId);
 // Cuando usuario está limitado a ciertas sedes, 'Todas' significa todas SUS sedes.
 // No incluir consultas de sede NULL sin grant explícito de toda la empresa.
 if(selected!=="todas") request=request.eq("sede_id",selected);
 else if(!scope.todas) request=request.in("sede_id",scope.sedes.map(s=>s.id));
 const limit=25;
 const {data,error,count}=await request.order("fecha_registro",{ascending:false})
  .range((page-1)*limit,page*limit-1);
 if(error)throw new Error("CONSULTATIONS_QUERY_FAILED");
 const rows=ensureTenantRows((data??[]) as Consulta[],ctx.companyId);
 const root="/portal/empresa/"+id+"/pets/mascotas/"+petId;
 const href=(n:number)=>root+"/historial?"+new URLSearchParams({sede:selected,page:String(n)}).toString();
 const names=new Map(scope.sedes.map(s=>[s.id,s.nombre]));
 return <main className="dashboardShell"><section className="dashboardContent wideContent">
  <Link href={root}>← Ficha de {pet.nombre}</Link>
  <p className="eyebrow">PETS · {ctx.companyName} · Solo lectura</p>
  <h1>Historial clínico compartido</h1>
  <p className="description">Una sola mascota, eventos de distintas sedes sin duplicar su ficha. Los registros anteriores a la migración pueden no tener sede identificada.</p>
  <form method="get" className="inlineForm">
    <label>Filtrar sede
      <select name="sede" defaultValue={selected}>
        <option value="todas">Todas las sedes autorizadas</option>
        {scope.sedes.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
      </select>
    </label>
    <button type="submit">Aplicar</button>
  </form>
  {rows.length?<div className="userList">{rows.map(c=><article className="userRow" key={c.id}>
    <div className="userIdentity">
      <strong>{c.tipo_servicio??"Consulta y control"}</strong>
      <small>{new Date(c.fecha_registro).toLocaleString("es-CO")} · {c.sede_id?(names.get(c.sede_id)??"Sede no disponible"):"Sede histórica no registrada"}</small>
      <p>{c.motivo_cita??"Sin motivo registrado"}</p>
      {c.diagnostico_definitivo?<p>Diagnóstico: {c.diagnostico_definitivo}</p>:null}
    </div>
  </article>)}</div>:<div className="emptyState">No hay consultas visibles para este filtro.</div>}
  <p>Página {page} · {count??0} consultas</p>
  <div className="listActions">
   {page>1?<Link href={href(page-1)}>← Anteriores</Link>:null}
   {page*limit<(count??0)?<Link href={href(page+1)}>Siguientes →</Link>:null}
  </div>
 </section></main>;
}
