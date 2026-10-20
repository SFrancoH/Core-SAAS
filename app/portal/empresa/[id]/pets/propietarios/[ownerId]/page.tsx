import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { UUID_RE } from "@/lib/core/access";
import { resolveSedeScope } from "@/lib/core/sedes";
import { requirePetTenant } from "@/lib/verticals/pets/tenant-context";
import { ensureTenantRows } from "@/lib/verticals/pets/tenant-policy";

export const dynamic = "force-dynamic";
type Owner = {
  id: string; empresa_id: string; sede_origen_id: string | null;
  nombre: string; telefono: string | null; whatsapp: string | null;
  ciudad: string | null; email: string | null; numero_documento: string | null;
};
export default async function TenantOwnerDetail({params}:{
  params:Promise<{id:string;ownerId:string}>
}) {
  const {id,ownerId}=await params;
  const context=await requirePetTenant(id,"pets.pet.read");
  if(!UUID_RE.test(ownerId)) notFound();
  const scope=await resolveSedeScope(context.actorId,context.companyId,"pets.pet.read");
  let query=getSupabaseAdmin().from("propietarios")
    .select("id,empresa_id,sede_origen_id,nombre,telefono,whatsapp,ciudad,email,numero_documento")
    .eq("empresa_id",context.companyId).eq("id",ownerId);
  if(!scope.todas) query=query.in("sede_origen_id",
    scope.sedes.length ? scope.sedes.map(s=>s.id) : ["00000000-0000-0000-0000-000000000000"]);
  const {data,error}=await query.maybeSingle();
  if(error||!data) notFound();
  const [owner]=ensureTenantRows([data as Owner],context.companyId);
  const sede=owner.sede_origen_id
    ? (scope.sedes.find(s=>s.id===owner.sede_origen_id)?.nombre??"Sede no disponible")
    : "Histórica sin sede";
  return <main className="dashboardShell"><section className="dashboardContent">
    <Link href={"/portal/empresa/"+context.companyId+"/pets/propietarios"}>← Propietarios</Link>
    <p className="eyebrow">PETS · {context.companyName} · Solo lectura</p>
    <h1>{owner.nombre}</h1>
    <div className="coreSection">
      <p><strong>Documento:</strong> {owner.numero_documento??"—"}</p>
      <p><strong>Teléfono:</strong> {owner.telefono??"—"}</p>
      <p><strong>WhatsApp:</strong> {owner.whatsapp??"—"}</p>
      <p><strong>Correo:</strong> {owner.email??"—"}</p>
      <p><strong>Ciudad:</strong> {owner.ciudad??"—"}</p>
      <p><strong>Sede de origen:</strong> {sede}</p>
    </div>
    <p className="coreDesignNote">Ficha de solo lectura. La edición y las asociaciones con mascotas se migrarán en C15.</p>
  </section></main>;
}
