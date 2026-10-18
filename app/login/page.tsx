import { redirect } from "next/navigation";

import PasswordField from "@/components/password-field";
import { getCurrentProfile } from "@/lib/core/auth";
import { login } from "./actions";

const messages: Record<string, string> = {
  campos: "Escribe tu correo y contraseña.",
  credenciales: "El correo o la contraseña no son correctos.",
  sin_acceso: "Tu usuario no tiene acceso activo. Comunícate con el administrador."
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const profile = await getCurrentProfile();
  if (profile) redirect("/panel");

  const params = await searchParams;
  const message = params?.error ? messages[params.error] : undefined;

  return (
    <main className="authShell">
      <section className="loginCard">
        <div className="brand">PETS</div>
        <p className="eyebrow">Acceso privado</p>
        <h1>Ingresa a tu cuenta</h1>
        <p className="description">
          Utiliza las credenciales asignadas por el administrador de tu empresa.
        </p>

        {message ? <div className="formAlert">{message}</div> : null}
        <form action={login} className="authForm">
          <label>
            Correo electrónico
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <PasswordField autoComplete="current-password" />
          <button type="submit">Ingresar</button>
        </form>

        <p className="recoveryNote">
          ¿Olvidaste tu contraseña? Solicita una nueva al administrador.
        </p>
      </section>
    </main>
  );
}
