import { redirect } from "next/navigation";
import DashboardHeader from "@/components/dashboard-header";
import PasswordField from "@/components/password-field";
import { requireProfile } from "@/lib/core/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createVeterinarian,
  resetVeterinarianPassword,
  setVeterinarianStatus
} from "./actions";

const successMessages: Record<string, string> = {
  usuario_creado: "Veterinario creado correctamente.",
  password: "La contraseña fue reemplazada.",
  estado: "El estado del usuario fue actualizado."
};

type Query = { ok?: string; error?: string };
type CompanyUser = { id: string; nombre: string; email: string; rol: string; activo: boolean };
export default async function CompanyPage({ searchParams }: { searchParams: Promise<Query> }) {
  const profile = await requireProfile(["empresa_admin", "veterinario"]);
  const supabase = await createSupabaseServerClient();
  if (!profile.empresa_id) redirect("/login?error=sin_acceso");
  const params = await searchParams;

  const [{ data: company }, { count: petCount }, { count: userCount }, { count: ownerCount }, usersResult] =
    await Promise.all([
      supabase
        .from("empresas")
        .select("id, nombre, activa")
        .eq("id", profile.empresa_id)
        .single(),
      supabase
        .from("mascotas")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("usuarios")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("propietarios")
        .select("id", { count: "exact", head: true }),
      profile.rol === "empresa_admin"
        ? supabase
            .from("usuarios")
            .select("id, nombre, email, rol, activo, created_at")
            .order("created_at")
        : Promise.resolve({ data: [] })
    ]);

  const users = (usersResult.data || []) as CompanyUser[];

  return (
    <main className="dashboardShell">
      <DashboardHeader profile={profile} context={company?.nombre || "Empresa"} active="panel" />

      <section className="dashboardContent">
        <p className="eyebrow">
          {profile.rol === "empresa_admin" ? "Administrador de empresa" : "Veterinario"}
        </p>
        <h1>Panel de {company?.nombre || "empresa"}</h1>
        <p className="description">
          Solo puedes consultar información perteneciente a esta empresa.
        </p>

        {params?.ok && successMessages[params.ok] ? (
          <div className="successAlert topAlert">{successMessages[params.ok]}</div>
        ) : null}
        {params?.error ? (
          <div className="formAlert topAlert">
            No fue posible completar la operación. Revisa los datos; el correo podría estar registrado.
          </div>
        ) : null}

        <div className="statsGrid">
          <article className="statCard">
            <span>Mascotas</span>
            <strong>{petCount || 0}</strong>
          </article>
          {profile.rol === "empresa_admin" ? (
            <article className="statCard">
              <span>Usuarios</span>
              <strong>{userCount || 0}</strong>
            </article>
          ) : null}
          <article className="statCard">
            <span>Propietarios</span>
            <strong>{ownerCount || 0}</strong>
          </article>
        </div>

        {profile.rol === "empresa_admin" ? (
          <>
            <section className="managementSection">
              <div>
                <p className="eyebrow">Nuevo acceso</p>
                <h2>Crear usuario veterinario</h2>
              </div>
              <form action={createVeterinarian} className="managementForm">
                <label>Nombre completo<input name="nombre" minLength={2} maxLength={120} required /></label>
                <label>Correo electrónico<input name="email" type="email" required /></label>
                <PasswordField label="Contraseña definitiva" />
                <button type="submit">Crear veterinario</button>
              </form>
            </section>

            <section className="managementSection">
              <div>
                <p className="eyebrow">Control de acceso</p>
                <h2>Usuarios</h2>
              </div>
              <div className="userList">
                {users.map((user) => (
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
                      {user.rol === "veterinario" ? (
                        <>
                          <details>
                            <summary>Cambiar contraseña</summary>
                            <form action={resetVeterinarianPassword} className="smallActionForm">
                              <input type="hidden" name="usuario_id" value={user.id} />
                              <input name="password" type="password" minLength={8} placeholder="Nueva contraseña" required />
                              <button type="submit">Guardar</button>
                            </form>
                          </details>
                          <form action={setVeterinarianStatus}>
                            <input type="hidden" name="usuario_id" value={user.id} />
                            <input type="hidden" name="activo" value={String(!user.activo)} />
                            <button className="buttonSecondary" type="submit">
                              {user.activo ? "Desactivar" : "Activar"}
                            </button>
                          </form>
                        </>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}
