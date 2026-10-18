import Link from "next/link";
import { redirect } from "next/navigation";
import { resolvePortalContext } from "@/lib/core/portal-access";

const LABELS: Record<string, string> = {
  PETS: "Gestión veterinaria",
  PULSE: "Rifas y boletas",
  AURA: "Clínicas estéticas",
  VISION: "Oftalmología",
  DRIVE: "Movilidad",
  NEURO: "Educación",
  LENS: "Ópticas"
};

export default async function PortalPage() {
  const context = await resolvePortalContext();
  if (!context) redirect("/login");
  if (context.role === "super_admin") redirect("/super-admin");

  // Mantener operativo el uso monocliente ya existente en PETS.
  if (context.mode === "legacy_pets" && context.workspaces.length === 1) redirect("/empresa");
  return <main className="dashboardShell">
    <section className="dashboardContent wideContent">
      <p className="eyebrow">CORE SAAS · Acceso general</p>
      <h1>Tus empresas y verticales</h1>
      <p className="description">Solo aparecen los productos con licencia vigente y pertenencia activa. El acceso a los datos se comprueba nuevamente en cada operación.</p>
      {!context.workspaces.length ? <div className="emptyState">
        <h2>Sin accesos habilitados</h2>
        <p>Solicita al administrador que asigne una empresa y una licencia activa.</p>
      </div> : null}
      {context.workspaces.map(space => <section className="coreSection" key={space.companyId}>
        <div className="coreSectionHeading"><h2>{space.companyName}</h2><span className="coreSectionMeta">{space.role === "admin" ? "Admin" : "User"}</span></div>
        <div className="coreProductGrid">
          {space.products.map(product => <article className="coreProductCard" key={product}>
            <div className="coreProductIcon">{product.slice(0,1)}</div>
            <h3>{product}</h3>
            <p>{LABELS[product] ?? "Vertical de Core SaaS"}</p>
            {product === "PETS" && process.env.CORE_PETS_MULTI_TENANT_READ_ENABLED === "true"
              ? <Link href={"/portal/empresa/"+space.companyId+"/pets/mascotas"}>PETS · Vista por empresa (lectura) →</Link>
              : product === "PETS" && space.canOpenPets
                ? <Link href="/empresa">Abrir PETS actual →</Link>
                : <span className="coreStatusUpcoming">{product === "PETS" ? "Pendiente activación del aislamiento multiempresa" : "Interfaz pendiente de implementación"}</span>}
          </article>)}
        </div>
        {space.role==="admin" ? <p><Link href={"/portal/empresa/"+space.companyId+"/usuarios"}>Administrar usuarios y permisos →</Link></p> : null}
      </section>)}
      <p className="coreDesignNote">El listado no sustituye las validaciones de empresa, licencia y permisos realizadas por el servidor.</p>
    </section>
  </main>;
}
