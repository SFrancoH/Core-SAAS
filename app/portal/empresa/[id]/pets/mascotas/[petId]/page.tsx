import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requirePetTenant } from "@/lib/verticals/pets/tenant-context";
import { ensureTenantRows } from "@/lib/verticals/pets/tenant-policy";
import { UUID_RE } from "@/lib/core/access";
import { resolveSedeScope } from "@/lib/core/sedes";

export const dynamic="force-dynamic";
type Pet={id:string;empresa_id:string;nombre:string;numero_carnet:string|null;
  especie:string|null;raza:string|null;sexo:string|null;estado:string|null;
  peso_kg:number|null;fecha_nacimiento:string|null;sede_origen_id:string|null};
export default async function TenantPetDetail({params}:{
  params:Promise<{id:string;petId:string}>
}) {
  const {id,petId}=await params;
  const ctx=await requirePetTenant(id,"pets.pet.read");
  if(!UUID_RE.test(petId))notFound();
  // El filtro tenant es obligatorio incluso tras autorizar al actor.
  const scope=await resolveSedeScope(ctx.actorId,ctx.companyId,"pets.pet.read");
  let request=getSupabaseAdmin().from("mascotas")
    .select("id,empresa_id,nombre,numero_carnet,especie,raza,sexo,estado,peso_kg,fecha_nacimiento,sede_origen_id")
    .eq("empresa_id",ctx.companyId).eq("id",petId);
  if (!scope.todas) request=request.in("sede_origen_id",scope.sedes.length ? scope.sedes.map(s=>s.id) : ["00000000-0000-0000-0000-000000000000"]);
  const {data,error}=await request.maybeSingle();
  if(error||!data)notFound();
  const [pet]=ensureTenantRows([data as Pet],ctx.companyId);
  return <main className="dashboardShell"><section className="dashboardContent">
    <Link href={"/portal/empresa/"+ctx.companyId+"/pets/mascotas"}>← Mascotas</Link>
    <p className="eyebrow">PETS · {ctx.companyName} · Solo lectura</p>
    <h1>{pet.nombre}</h1>
    <div className="coreSection">
      <p><strong>Carnet:</strong> {pet.numero_carnet??"—"}</p>
      <p><strong>Especie:</strong> {pet.especie??"—"}</p>
      <p><strong>Raza:</strong> {pet.raza??"—"}</p>
      <p><strong>Sexo:</strong> {pet.sexo??"—"}</p>
      <p><strong>Peso:</strong> {pet.peso_kg??"—"} kg</p>
      <p><strong>Fecha de nacimiento:</strong> {pet.fecha_nacimiento??"—"}</p>
      <p><strong>Estado:</strong> {pet.estado??"—"}</p>
      <p><strong>Sede de origen:</strong> {pet.sede_origen_id ? (scope.sedes.find(s=>s.id===pet.sede_origen_id)?.nombre??"Sede no disponible") : "Histórica sin sede"}</p>
    </div>
    <p><Link href={"/portal/empresa/"+ctx.companyId+"/pets/mascotas/"+petId+"/historial"}>Ver historial clínico por sedes →</Link></p>
    <p className="coreDesignNote">La edición clínica multiempresa aún no está habilitada. El historial es únicamente de lectura.</p>
  </section></main>;
}
