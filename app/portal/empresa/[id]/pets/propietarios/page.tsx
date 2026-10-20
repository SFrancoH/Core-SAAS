import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveSedeScope } from "@/lib/core/sedes";
import { requirePetTenant } from "@/lib/verticals/pets/tenant-context";
import { ensureTenantRows, normalizePetPage } from "@/lib/verticals/pets/tenant-policy";
import { sanitizeSearch } from "@/lib/verticals/pets/operational";

export const dynamic="force-dynamic";
type OwnerRow={id:string;empresa_id:string;nombre:string;
  telefono:string|null;ciudad:string|null;email:string|null;sede_origen_id:string|null};
const limit=25;
export default async function TenantOwnersPage({params,searchParams}:{
  params:Promise<{id:string}>; searchParams:Promise<{page?:string;q?:string}>
}) {
  const {id}=await params;
  const ctx=await requirePetTenant(id,"pets.pet.read");
  const scope=await resolveSedeScope(ctx.actorId,ctx.companyId,"pets.pet.read");
  const search=await searchParams;
  const page=normalizePetPage(search.page),q=sanitizeSearch(search.q);
  let db=getSupabaseAdmin().from("propietarios")
    .select("id,empresa_id,nombre,telefono,ciudad,email,sede_origen_id",{count:"exact"})
    .eq("empresa_id",ctx.companyId);
  // Las fichas sin sede legada solo son visibles con alcance empresarial completo.
  if (!scope.todas) db=db.in("sede_origen_id",scope.sedes.length ? scope.sedes.map(s=>s.id) : ["00000000-0000-0000-0000-000000000000"]);
  if(q)db=db.or("nombre.ilike.%"+q+"%,telefono.ilike.%"+q+"%,email.ilike.%"+q+"%");
  const {data,error,count}=await db.order("nombre").range((page-1)*limit,page*limit-1);
  if(error)throw new Error("No fue posible consultar propietarios del contexto");
  const owners=ensureTenantRows((data??[]) as OwnerRow[],ctx.companyId);
  const sedeNames=new Map(scope.sedes.map(s=>[s.id,s.nombre]));
  const root="/portal/empresa/"+ctx.companyId+"/pets";
  const href=(n:number)=>root+"/propietarios?"+new URLSearchParams({page:String(n),...(q?{q}:{})}).toString();
  return <main className="dashboardShell"><section className="dashboardContent wideContent">
    <Link href={root+"/mascotas"}>← Mascotas</Link>
    <p className="eyebrow">PETS · {ctx.companyName} · Solo lectura</p>
    <h1>Propietarios</h1>
    <p><a href={"/api/core/empresas/"+ctx.companyId+"/pets/export/propietarios"}>Exportar propietarios de esta empresa (Excel)</a></p>
    <p className="description">Directorio filtrado exclusivamente por la empresa autorizada.</p>
    <form method="get" className="inlineForm">
      <input type="search" name="q" defaultValue={q} placeholder="Nombre, teléfono o correo"/>
      <button type="submit">Buscar</button>
    </form>
    {owners.length?<div className="userList">{owners.map(o=><article key={o.id} className="userRow">
      <div className="userIdentity"><strong>{o.nombre}</strong>
        <small>{o.telefono??"—"} · {o.ciudad??"—"} · {o.email??"—"} · Sede: {o.sede_origen_id ? (sedeNames.get(o.sede_origen_id)??"Sede no disponible") : "Histórica sin sede"}</small>
      </div>
    </article>)}</div>:<div className="emptyState">No hay propietarios que coincidan.</div>}
    <p className="description">Página {page} · {count??0} propietarios</p>
    <div className="listActions">
      {page>1?<Link href={href(page-1)}>← Anteriores</Link>:null}
      {page*limit<(count??0)?<Link href={href(page+1)}>Siguientes →</Link>:null}
    </div>
  </section></main>;
}
