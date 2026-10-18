import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requirePetTenant } from "@/lib/verticals/pets/tenant-context";
import { ensureTenantRows } from "@/lib/verticals/pets/tenant-policy";
import { UUID_RE } from "@/lib/core/access";

export const dynamic="force-dynamic";
type Pet={id:string;empresa_id:string;nombre:string;numero_carnet:string|null;
  especie:string|null;raza:string|null;sexo:string|null;estado:string|null;
  peso_kg:number|null;fecha_nacimiento:string|null};
export default async function TenantPetDetail({params}:{
  params:Promise<{id:string;petId:string}>
}) {
  const {id,petId}=await params;
  const ctx=await requirePetTenant(id,"pets.pet.read");
  if(!UUID_RE.test(petId))notFound();
  // El filtro tenant es obligatorio incluso tras autorizar al actor.
  const {data,error}=await getSupabaseAdmin().from("mascotas")
    .select("id,empresa_id,nombre,numero_carnet,especie,raza,sexo,estado,peso_kg,fecha_nacimiento")
    .eq("empresa_id",ctx.companyId).eq("id",petId).maybeSingle();
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
    </div>
    <p className="coreDesignNote">La edición y el historial clínico multiempresa aún no están habilitados. Se migrarán junto con la autorización de escritura y los vínculos de datos.</p>
  </section></main>;
}
