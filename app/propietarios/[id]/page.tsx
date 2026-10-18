// @ts-nocheck — pendiente tipar lógica heredada PETS.
import Link from "next/link";
import { notFound } from "next/navigation";

import DashboardHeader from "@/components/dashboard-header";
import OwnerEditForm from "@/components/owner-edit-form";
import { mostrarSede } from "@/lib/verticals/pets/sede-display";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireOperationalProfile } from "@/lib/verticals/pets/operational";

export default async function OwnerDetailPage({ params, searchParams }) {
  const urlParams = await searchParams;
  const profile = await requireOperationalProfile();
  const { id } = await params;
  const admin = getSupabaseAdmin();
  let query = admin
    .from("propietarios")
    .select(`*, empresas(nombre), propietarios_mascotas(mascotas(id, nombre, numero_carnet, especie, raza, sexo, estado, fecha_fallecimiento))`)
    .eq("id", id);
  if (profile.rol !== "super_admin") query = query.eq("empresa_id", profile.empresa_id);
  const { data: owner, error: ownerError } = await query.maybeSingle();
  if (ownerError) {
    console.error("Error al consultar propietario", { code: ownerError.code, message: ownerError.message });
    throw new Error("No fue posible consultar el propietario en Supabase.");
  }
  if (!owner) notFound();

  const pets = (owner.propietarios_mascotas || []).map((relation) => relation.mascotas).filter(Boolean);
  const details = [
    ["Ciudad", owner.ciudad], ["Dirección", owner.direccion], ["Teléfono", owner.telefono],
    ["WhatsApp", owner.whatsapp], ["Email", owner.email], ["Tipo de documento", owner.tipo_documento],
    ["Número de documento", owner.numero_documento], ["Estado", owner.estado],
    ["Notificaciones de WhatsApp", owner.notificaciones_whatsapp ? "Sí" : "No"],
    ["Tags", (owner.tags || []).join(", ")],
    ["SEDE", mostrarSede(owner.fuente)]
  ];

  return (
    <main className="dashboardShell">
      <DashboardHeader profile={profile} context={profile.rol === "super_admin" ? "Superadministrador" : "Operación"} active="propietarios" />
      <section className="dashboardContent wideContent">
        <Link className="backLink" href="/propietarios">← Volver a propietarios</Link>
        <div className="recordHeading">
          <div><p className="eyebrow">Ficha de propietario</p><h1>{owner.nombre}</h1><p className="description">SEDE: {mostrarSede(owner.fuente)}</p></div>
          <span className={owner.estado?.toLowerCase() === "inactivo" ? "badgeInactive" : "badgeActive"}>{owner.estado || "Activo"}</span>
        </div>

        <section className="recordSection">
          <p className="eyebrow">Información general</p><h2>Detalles del propietario</h2>
          <dl className="detailGrid">{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}</dl>
        </section>

        <OwnerEditForm owner={owner} editing={urlParams?.editar === "1"} error={urlParams?.error_perfil === "1"} success={urlParams?.perfil_actualizado === "1"} />

        <section className="recordSection">
          <p className="eyebrow">Relaciones</p><h2>Mascotas asociadas</h2>
          <div className="associationGrid">
            {pets.length ? pets.map((pet) => (
              <Link className="associationCard" href={`/mascotas/${pet.id}`} key={pet.id}>
                <strong>{pet.nombre}</strong>
                <span>{[pet.raza, pet.especie].filter(Boolean).join(" · ") || "Sin tipo registrado"}</span>
                <small>Carnet: {pet.numero_carnet || "Sin carnet"}</small>
              </Link>
            )) : <div className="emptyState"><h2>Sin mascotas asociadas</h2><p>Este propietario todavía no tiene mascotas vinculadas.</p></div>}
          </div>
        </section>
      </section>
    </main>
  );
}
