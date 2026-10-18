"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/core/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertNoSupportMode } from "@/lib/core/support-guard";
import { UUID_RE } from "@/lib/core/access";

export async function crearSede(form:FormData):Promise<void>{
  await assertNoSupportMode();
  if(process.env.CORE_PETS_MULTI_TENANT_READ_ENABLED!=="true") redirect("/portal");
  const profile=await getCurrentProfile();
  if(!profile) redirect("/login");
  const empresaId=String(form.get("empresa_id")??"");
  const codigo=String(form.get("codigo")??"").trim().toUpperCase();
  const nombre=String(form.get("nombre")??"").trim();
  if(!UUID_RE.test(empresaId)) redirect("/portal");
  const base="/portal/empresa/"+empresaId+"/sedes";
  if(!/^[A-Z0-9_-]{2,32}$/.test(codigo)||nombre.length<2||nombre.length>120){
    redirect(base+"?error=datos");
  }
  const {data,error}=await getSupabaseAdmin().rpc("core_crear_sede",{
    p_actor_id:profile.id,p_empresa_id:empresaId,p_codigo:codigo,p_nombre:nombre
  });
  if(error||typeof data!=="string"||!UUID_RE.test(data)){
    redirect(base+"?error=guardar");
  }
  revalidatePath(base);
  redirect(base+"?ok=creada");
}
