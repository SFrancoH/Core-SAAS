import CoreAdminHeader from "@/components/layouts/core-admin-header";
import { requireProfile } from "@/lib/core/auth";

const tokens = [
  ["Principal", "var(--color-primary)"],
  ["Texto", "var(--color-text)"],
  ["Fondo", "var(--color-page)"],
  ["Superficie", "var(--color-surface)"],
  ["Borde", "var(--color-border)"],
  ["Éxito", "var(--color-success-strong)"],
  ["Error", "var(--color-danger)"],
  ["Aviso", "var(--color-warning)"]
] as const;

export default async function GlobalDesignPage() {
  const profile = await requireProfile(["super_admin"]);
  return <main className="dashboardShell coreAdminShell">
    <CoreAdminHeader profile={profile} active="apariencia"/>
    <section className="dashboardContent wideContent coreAdminContent">
      <p className="eyebrow">Core Admin · Sistema de diseño</p>
      <h1>Apariencia global</h1>
      <p className="description">Esta es una vista de referencia de los estilos de Core SaaS. Las variables reales están centralizadas en <code>styles/tokens.css</code>. Cambiarlas en ese archivo y desplegar el proyecto actualiza todas las verticales.</p>
      <section className="coreSection">
        <div className="coreSectionHeading"><h2>Paleta compartida</h2></div>
        <div className="coreSwatchGrid">
          {tokens.map(([label, color]) =>
            <article className="coreSwatch" key={label}>
              <div className="coreSwatchColor" style={{ backgroundColor: color }}/>
              <strong>{label}</strong><small>{color}</small>
            </article>)}
        </div>
      </section>
      <section className="coreSection">
        <div className="coreSectionHeading"><h2>Componentes de referencia</h2></div>
        <div className="corePreviewSurface">
          <div><p className="eyebrow">Título de sección</p><h2>Una estética para todo el SaaS</h2><p className="description">Los botones, campos, tarjetas, textos, bordes y estados comparten los mismos tokens.</p></div>
          <div className="corePreviewActions"><button type="button">Acción principal</button><button type="button" className="buttonSecondary">Acción secundaria</button></div>
          <label className="corePreviewField">Campo de formulario<input placeholder="Ejemplo de campo" disabled/></label>
          <div className="successAlert">Ejemplo de confirmación</div>
          <div className="formAlert">Ejemplo de error</div>
        </div>
      </section>
      <p className="coreDesignNote">Esta pantalla no permite editar o guardar temas todavía. La administración de apariencia dinámica requerirá un modelo de configuración y permisos específico.</p>
    </section>
  </main>;
}
