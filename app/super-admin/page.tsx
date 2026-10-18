import Link from "next/link";
import CoreAdminHeader from "@/components/layouts/core-admin-header";
import { StatCard } from "@/components/ui/stat-card";
import { requireProfile } from "@/lib/core/auth";
import { getCoreAdminOverview } from "@/lib/core/admin/overview";
import { createCompany } from "./actions";

type Query = { ok?: string; error?: string };
type Props = { searchParams: Promise<Query> };

export default async function SuperAdminPage({ searchParams }: Props) {
  const profile = await requireProfile(["super_admin"]);
  const [{ companies, activeCompanies }, params] = await Promise.all([
    getCoreAdminOverview(), searchParams
  ]);

  return (
    <main className="dashboardShell coreAdminShell">
      <CoreAdminHeader profile={profile} active="empresas" />
      <section className="dashboardContent wideContent coreAdminContent">
        <div className="corePageIntro">
          <div>
            <p className="eyebrow">CORE ADMIN · Plataforma global</p>
            <h1>Empresas</h1>
            <p className="description">
              Gestiona las organizaciones del SaaS. Cada empresa conserva su información y acceso independiente.
            </p>
          </div>
          <form action={createCompany} className="inlineForm coreCreateCompany">
            <label className="visuallyHidden" htmlFor="core-company-name">Nombre de la empresa</label>
            <input id="core-company-name" name="nombre" placeholder="Nombre de la empresa" minLength={2} maxLength={120} required />
            <button type="submit">Crear empresa</button>
          </form>
        </div>

        {params?.ok === "empresa" && <div className="successAlert">Empresa creada correctamente.</div>}
        {params?.error && <div className="formAlert">No fue posible crear la empresa.</div>}

        <div className="coreStatsGrid">
          <StatCard label="Empresas registradas" value={companies.length} description="Todas las organizaciones" />
          <StatCard label="Empresas activas" value={activeCompanies} description="Estado activo en Core" />
          <StatCard label="Verticales con interfaz" value="1" description="PETS, la primera vertical" />
        </div>

        <section className="coreSection">
          <div className="coreSectionHeading">
            <div>
              <p className="eyebrow">Directorio</p>
              <h2>Organizaciones</h2>
            </div>
            <span className="coreSectionMeta">{companies.length} en total</span>
          </div>
          <div className="companyGrid">
            {companies.length ? companies.map(company => (
              <Link className="companyCard companyCardLink" href={"/super-admin/empresas/" + company.id} key={company.id}>
                <div className="companyIcon">{company.nombre.slice(0, 1).toUpperCase()}</div>
                <div>
                  <h2>{company.nombre}</h2>
                  <span className={company.activa ? "badgeActive" : "badgeInactive"}>
                    {company.activa ? "Activa" : "Inactiva"}
                  </span>
                </div>
                <span className="cardArrow" aria-hidden="true">→</span>
              </Link>
            )) : (
              <div className="emptyState">
                <h2>Aún no hay empresas</h2>
                <p>Crea la primera organización con el formulario superior.</p>
              </div>
            )}
          </div>
        </section>
        <section className="coreSection" aria-labelledby="verticals-title">
          <div className="coreSectionHeading">
            <div><p className="eyebrow">Catálogo</p><h2 id="verticals-title">Verticales del producto</h2></div>
          </div>
          <div className="coreProductGrid">
            <article className="coreProductCard coreProductEnabled">
              <div className="coreProductIcon">P</div>
              <h3>PETS</h3>
              <p>Clínicas veterinarias, propietarios, mascotas y consultas.</p>
              <Link href="/mascotas">Abrir vertical <span aria-hidden="true">↗</span></Link>
            </article>
            {[
              ["PULSE", "Rifas, proyectos y boletas"],
              ["AURA", "Clínicas estéticas"],
              ["VISION", "Oftalmología"],
              ["DRIVE", "Movilidad"],
              ["NEURO", "Educación"],
              ["LENS", "Ópticas"]
            ].map(([name, description]) => (
              <article className="coreProductCard" key={name}>
                <div className="coreProductIcon coreProductInactive">{name.slice(0, 1)}</div>
                <h3>{name}</h3>
                <p>{description}</p>
                <span className="coreStatusUpcoming">Sin implementación</span>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
