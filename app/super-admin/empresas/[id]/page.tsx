import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";

import CoreAdminHeader from "@/components/layouts/core-admin-header";
import PasswordField from "@/components/password-field";
import { requireProfile } from "@/lib/core/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  createCompanyAdmin,
  resetCompanyUserPassword,
  saveContactIntegration,
  setCompanyUserStatus
} from "./actions";

const successMessages = {
  usuario_creado: "Administrador creado correctamente.",
  password: "La contraseña fue reemplazada.",
  estado: "El estado del usuario fue actualizado.",
  integracion: "La conexión del formulario fue guardada."
};

type CompanyDetailProps = { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: keyof typeof successMessages; error?: string }> };
type CompanyUser = { id: string; nombre: string; email: string; rol: string; activo: boolean };

export default async function CompanyDetailPage({ params, searchParams }: CompanyDetailProps) {
  const profile = await requireProfile(["super_admin"]);
  const { id } = await params;
  const query = await searchParams;
  const admin = getSupabaseAdmin();

  const [{ data: company }, { data: rawUsers = [] }, { count: petCount }, { count: ownerCount }, { data: integration }] =
    await Promise.all([
      admin.from("empresas").select("id, nombre, activa").eq("id", id).maybeSingle(),
      admin
        .from("usuarios")
        .select("id, nombre, email, rol, activo, created_at")
        .eq("empresa_id", id)
        .order("created_at"),
      admin.from("mascotas").select("id", { count: "exact", head: true }).eq("empresa_id", id),
      admin.from("propietarios").select("id", { count: "exact", head: true }).eq("empresa_id", id),
      admin.from("integraciones_contacto").select("formulario_url, webhook_token, activa").eq("empresa_id", id).maybeSingle()
    ]);

  const users = (rawUsers ?? []) as CompanyUser[];
  if (!company) notFound();
  const requestHeaders = await headers();
  const protocol = requestHeaders.get("x-forwarded-proto") || "https";
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const webhookUrl = integration?.webhook_token && host
    ? `${protocol}://${host}/api/integraciones/contactos/${integration.webhook_token}`
    : "Se generará al guardar";

  return (
    <main className="dashboardShell">
      <CoreAdminHeader profile={profile} active="empresas" />

      <section className="dashboardContent">
        <Link className="backLink" href="/super-admin">← Volver a empresas</Link>
        <p className="eyebrow">Detalle de empresa</p>
        <h1>{company.nombre}</h1>

        {query?.ok && successMessages[query.ok] ? (
          <div className="successAlert topAlert">{successMessages[query.ok]}</div>
        ) : null}
        {query?.error ? (
          <div className="formAlert topAlert">
            No fue posible completar la operación. Revisa los datos; el correo podría estar registrado.
          </div>
        ) : null}

        <div className="statsGrid compactStats">
          <article className="statCard"><span>Usuarios</span><strong>{users.length}</strong></article>
          <article className="statCard"><span>Mascotas</span><strong>{petCount || 0}</strong></article>
          <article className="statCard"><span>Propietarios</span><strong>{ownerCount || 0}</strong></article>
        </div>

        <section className="managementSection">
          <div>
            <p className="eyebrow">Accesos por producto</p>
            <h2>Permisos y licencias Core</h2>
            <p className="description">Activa o suspende PETS, PULSE y los demás productos para esta empresa, sin modificar permisos de usuario.</p>
            <Link href={"/super-admin/empresas/"+company.id+"/licencias"}>Administrar licencias →</Link>
          </div>
        </section>

        <section className="managementSection integrationSection">
          <div>
            <p className="eyebrow">Confirmación de propietarios</p>
            <h2>Formulario conectado</h2>
            <p className="description">Cada empresa usa su propio formulario. El webhook crea el propietario y termina la asociación con la mascota.</p>
          </div>
          <form action={saveContactIntegration} className="managementForm">
            <input type="hidden" name="empresa_id" value={company.id} />
            <label className="fullField">Enlace del formulario<input name="formulario_url" type="url" defaultValue={integration?.formulario_url || "https://conector.soysebastianfranco.com/widget/form/wV0bT5wpaoyoGczetwSP"} placeholder="https://.../widget/form/..." required /></label>
            <label className="checkLabel"><input name="activa" type="checkbox" defaultChecked={integration?.activa ?? true} /> Conexión activa</label>
            <button type="submit">Guardar conexión</button>
          </form>
          <div className="webhookBox"><span>URL para el webhook de confirmación</span><code>{webhookUrl}</code><small>Configura una solicitud POST con JSON y conserva esta URL de forma privada.</small></div>
        </section>

        <section className="managementSection">
          <div>
            <p className="eyebrow">Nuevo acceso</p>
            <h2>Crear administrador de empresa</h2>
          </div>
          <form action={createCompanyAdmin} className="managementForm">
            <input type="hidden" name="empresa_id" value={company.id} />
            <label>Nombre completo<input name="nombre" minLength={2} maxLength={120} required /></label>
            <label>Correo electrónico<input name="email" type="email" required /></label>
            <PasswordField label="Contraseña definitiva" />
            <button type="submit">Crear administrador</button>
          </form>
        </section>

        <section className="managementSection">
          <div>
            <p className="eyebrow">Control de acceso</p>
            <h2>Usuarios de la empresa</h2>
          </div>

          <div className="userList">
            {users.length ? users.map((user) => (
              <article className="userRow" key={user.id}>
                <div className="userIdentity">
                  <strong>{user.nombre}</strong>
                  <span>{user.email}</span>
                  <small>{user.rol === "empresa_admin" ? "Administrador" : "Veterinario"}</small>
                </div>
                <div className="userActions">
                  <span className={user.activo ? "badgeActive" : "badgeInactive"}>
                    {user.activo ? "Activo" : "Inactivo"}
                  </span>
                  <details>
                    <summary>Cambiar contraseña</summary>
                    <form action={resetCompanyUserPassword} className="smallActionForm">
                      <input type="hidden" name="empresa_id" value={company.id} />
                      <input type="hidden" name="usuario_id" value={user.id} />
                      <input name="password" type="password" minLength={8} placeholder="Nueva contraseña" required />
                      <button type="submit">Guardar</button>
                    </form>
                  </details>
                  <form action={setCompanyUserStatus}>
                    <input type="hidden" name="empresa_id" value={company.id} />
                    <input type="hidden" name="usuario_id" value={user.id} />
                    <input type="hidden" name="activo" value={String(!user.activo)} />
                    <button className="buttonSecondary" type="submit">
                      {user.activo ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                </div>
              </article>
            )) : (
              <div className="emptyState">
                <h2>No hay usuarios</h2>
                <p>Crea el primer administrador de esta empresa.</p>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
