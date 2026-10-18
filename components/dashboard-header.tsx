// @ts-nocheck — lógica/props PETS aún requieren tipado estricto.
import Link from "next/link";

import { logout } from "@/app/actions";

export default function DashboardHeader({ profile, context, active }) {
  const isSuperAdmin = profile.rol === "super_admin";

  return (
    <header className="dashboardHeader operationalHeader">
      <div className="headerBrand">
        <div className="brand">PETS</div>
        <p>{context}</p>
      </div>

      <nav className="primaryNav" aria-label="Navegación principal">
        <Link className={active === "panel" ? "active" : ""} href="/panel">Resumen</Link>
        <Link className={active === "mascotas" ? "active" : ""} href="/mascotas">Mascotas</Link>
        <Link className={active === "propietarios" ? "active" : ""} href="/propietarios">Propietarios</Link>
        <Link className={active === "registro" ? "active" : ""} href="/registros/nuevo">Nuevo registro</Link>
        {isSuperAdmin ? (
          <Link className={active === "empresas" ? "active" : ""} href="/super-admin">Empresas</Link>
        ) : null}
      </nav>

      <div className="userMenu">
        <span>{profile.nombre}</span>
        <form action={logout}>
          <button className="buttonSecondary">Cerrar sesión</button>
        </form>
      </div>
    </header>
  );
}
