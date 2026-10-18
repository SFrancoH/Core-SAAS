import Link from "next/link";

import DashboardHeader from "@/components/dashboard-header";
import { requireProfile } from "@/lib/core/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createCompany } from "./actions";

export default async function SuperAdminPage({ searchParams }) {
  const profile = await requireProfile(["super_admin"]);
  const supabase = await createSupabaseServerClient();
  const params = await searchParams;
  const { data: companies = [] } = await supabase
    .from("empresas")
    .select("id, nombre, activa, created_at")
    .order("nombre");

  return (
    <main className="dashboardShell">
      <DashboardHeader profile={profile} context="Superadministrador" active="empresas" />

      <section className="dashboardContent">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">Administración general</p>
            <h1>Empresas</h1>
            <p className="description">
              Cada empresa mantiene separados sus usuarios y mascotas.
            </p>
          </div>
          <form action={createCompany} className="inlineForm">
            <input
              name="nombre"
              placeholder="Nombre de la empresa"
              minLength={2}
              maxLength={120}
              required
            />
            <button type="submit">Crear empresa</button>
          </form>
        </div>

        {params?.ok === "empresa" ? (
          <div className="successAlert">Empresa creada correctamente.</div>
        ) : null}
        {params?.error ? (
          <div className="formAlert">No fue posible crear la empresa.</div>
        ) : null}

        <div className="companyGrid">
          {companies.length ? (
            companies.map((company) => (
              <Link
                className="companyCard companyCardLink"
                href={`/super-admin/empresas/${company.id}`}
                key={company.id}
              >
                <div className="companyIcon">{company.nombre.slice(0, 1).toUpperCase()}</div>
                <div>
                  <h2>{company.nombre}</h2>
                  <span className={company.activa ? "badgeActive" : "badgeInactive"}>
                    {company.activa ? "Activa" : "Inactiva"}
                  </span>
                </div>
                <span className="cardArrow" aria-hidden="true">→</span>
              </Link>
            ))
          ) : (
            <div className="emptyState">
              <h2>Aún no hay empresas</h2>
              <p>Crea la primera empresa con el formulario superior.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
