import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface CoreCompany {
  id: string;
  nombre: string;
  activa: boolean;
  created_at: string | null;
}

// Uso exclusivo después del guard super_admin del controlador.
export async function getCoreAdminOverview(): Promise<{
  companies: CoreCompany[];
  activeCompanies: number;
}> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("empresas")
    .select("id, nombre, activa, created_at")
    .order("nombre");
  if (error) throw new Error("No fue posible consultar las empresas de Core");
  const companies = (data ?? []) as CoreCompany[];
  return { companies, activeCompanies: companies.filter(c => c.activa).length };
}
