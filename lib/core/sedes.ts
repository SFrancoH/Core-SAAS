import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { UUID_RE } from "@/lib/core/access";

/** Las sedes autorizadas se resuelven en BD a partir del actor autenticado;
 * no usar la sede enviada por el cliente como prueba de autorización. */
export type Sede = { id: string; nombre: string; codigo: string };
export type SedeScope = { todas: boolean; sedes: Sede[] };

export async function resolveSedeScope(
  actorId: string, empresaId: string, permiso: string
): Promise<SedeScope> {
  if (!UUID_RE.test(actorId) || !UUID_RE.test(empresaId) || !permiso) {
    throw new Error("INVALID_SEDE_SCOPE");
  }
  const {data,error}=await getSupabaseAdmin().rpc("core_contexto_sedes",{
    p_actor_id:actorId,p_empresa_id:empresaId,p_permiso:permiso
  });
  if(error||!data||typeof data!=="object"||Array.isArray(data)){
    throw new Error("SEDE_SCOPE_UNAVAILABLE");
  }
  const record=data as Record<string,unknown>;
  if(typeof record.todas!=="boolean"||!Array.isArray(record.sedes)){
    throw new Error("SEDE_SCOPE_INVALID");
  }
  const sedes: Sede[]=[];
  for(const item of record.sedes){
    if(!item||typeof item!=="object"||Array.isArray(item)) throw new Error("SEDE_SCOPE_INVALID");
    const sede=item as Record<string,unknown>;
    if(typeof sede.id!=="string"||!UUID_RE.test(sede.id)||
      typeof sede.nombre!=="string"||typeof sede.codigo!=="string"){
      throw new Error("SEDE_SCOPE_INVALID");
    }
    sedes.push({id:sede.id,nombre:sede.nombre,codigo:sede.codigo});
  }
  return {todas:record.todas,sedes};
}

export function canSelectSede(scope:SedeScope, requested:string):boolean {
  if(requested==="todas") return scope.todas || scope.sedes.length>0;
  return UUID_RE.test(requested) && scope.sedes.some(s=>s.id===requested);
}
