import Link from "next/link";
import { logout } from "@/app/actions";
import type { CoreProfile } from "@/lib/core/auth";

type Props = { profile: Pick<CoreProfile, "nombre" | "rol">; active?: "empresas" | "apariencia" };

export default function CoreAdminHeader({ profile, active = "empresas" }: Props) {
  return (
    <header className="coreAdminHeader">
      <div className="coreHeaderIdentity">
        <Link href="/super-admin" className="coreLogo" aria-label="Core SaaS, administración general">
          <span className="coreLogoMark">C</span>
          <span>CORE <strong>SAAS</strong><small>ADMINISTRACIÓN GLOBAL</small></span>
        </Link>
      </div>
      <nav className="coreHeaderNav" aria-label="Módulos de la plataforma">
        <Link className={active === "empresas" ? "coreNavActive" : ""} href="/super-admin">Empresas</Link>
        <Link className={active === "apariencia" ? "coreNavActive" : ""} href="/super-admin/apariencia">Diseño global</Link>
        <Link href="/super-admin/usuarios">Usuarios</Link>
        <Link href="/super-admin/soporte">Ver como usuario</Link>
        <Link href="/mascotas">Abrir PETS ↗</Link>
      </nav>
      <div className="coreHeaderUser">
        <span className="coreAvatar" aria-hidden="true">{profile.nombre.slice(0,1).toUpperCase()}</span>
        <div className="coreUserInfo"><strong>{profile.nombre}</strong><small>Superadministrador</small></div>
        <form action={logout}><button className="buttonSecondary coreLogout" type="submit">Salir</button></form>
      </div>
    </header>
  );
}
