import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requirePetTenant } from "@/lib/verticals/pets/tenant-context";
import { ensureTenantRows, normalizePetPage } from "@/lib/verticals/pets/tenant-policy";
import { sanitizeSearch } from "@/lib/verticals/pets/operational";

export const dynamic = "force-dynamic";
type PetRow={ id:string; empresa_id:string; nombre:string; numero_carnet:string|null;
  especie:string|null; raza:string|null; estado:string|null };
const pageSize=25;
export default async function TenantPetsPage({params,searchParams}:{
  params:Promise<{id:string}>; searchParams:Promise<{page?:string;q?:string}>
}) {
  const {id}=await params;
  const context=await requirePetTenant(id,"pets.pet.read");
  const query=await searchParams;
  const page=normalizePetPage(query.page);
  const q=sanitizeSearch(query.q);
  let db=getSupabaseAdmin().from("mascotas").select(
    "id,empresa_id,nombre,numero_carnet,especie,raza,estado",{count:"exact"}
  ).eq("empresa_id",context.companyId);
  if(q)db=db.or(\`nombre.ilike.%\${q}%,numero_carnet.ilike.%\${q}%,especie.ilike.%\${q}%\`);
  const {data,error,count}=await db.order("nombre")
    .range((page-1)*pageSize,page*pageSize-1);
  if(error)throw new Error("No fue posible consultar las mascotas del contexto");
  const pets=ensureTenantRows((data??[]) as PetRow[],context.companyId);
  const root="/portal/empresa/"+context.companyId+"/pets";
  const build=(n:number)=>root+"/mascotas?"+new URLSearchParams({page:String(n),...(q?{q}:{})}).toString();
  return <main className="dashboardShell"><section className="dashboardContent wideContent">
    <Link href="/portal">← Mis empresas</Link>
    <p className="eyebrow">PETS · {context.companyName} · Solo lectura</p>
    <h1>Mascotas</h1>
    <p className="description">Todas las consultas están limitadas a la empresa seleccionada y autorizada. Las operaciones clínicas de edición siguen disponibles únicamente en el sistema legacy hasta migrarlas.</p>
    <div className="listActions"><Link className="actionLink" href={root+"/propietarios"}>Propietarios</Link></div>
    <form method="get" className="inlineForm">
      <input type="search" name="q" defaultValue={q} placeholder="Buscar mascota, carnet o especie"/>
      <button type="submit">Buscar</button>
    </form>
    <div className="coreSection">
      {pets.length?<div className="userList">{pets.map(p=><article className="userRow" key={p.id}>
        <div className="userIdentity">
          <Link href={root+"/mascotas/"+p.id}><strong>{p.nombre}</strong></Link>
          <small>Carnet: {p.numero_carnet??"—"} · {p.especie??"—"} · {p.raza??"—"}</small>
        </div><span>{p.estado??"—"}</span>
      </article>)}</div>:<div className="emptyState">No se encontraron mascotas en esta empresa.</div>}
      <p className="description">Página {page} · {count??0} mascotas</p>
      <div className="listActions">
        {page>1?<Link href={build(page-1)}>← Anteriores</Link>:null}
        {page*pageSize<(count??0)?<Link href={build(page+1)}>Siguientes →</Link>:null}
      </div>
    </div>
  </section></main>;
}
