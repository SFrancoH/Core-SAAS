import Link from "next/link";
import { notFound } from "next/navigation";

import DashboardHeader from "@/components/dashboard-header";
import OwnerRegistrationFields from "@/components/owner-registration-fields";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { mostrarSede } from "@/lib/verticals/pets/sede-display";
import { requireOperationalProfile } from "@/lib/verticals/pets/operational";
import { addOwnerToPet } from "./actions";

const errors: Record<string, string> = {
  datos: "Completa los datos del propietario y selecciona una sede válida. WhatsApp debe tener al menos 7 dígitos.",
  conflicto: "El documento o el teléfono coincide con propietarios diferentes, o el teléfono pertenece a otro documento. Revisa la información antes de asociar: no se creó ningún duplicado.",
  migracion: "Falta ejecutar la migración SQL 009 en Supabase antes de asociar propietarios.",
  guardar: "No fue posible asociar el propietario. Comprueba los datos e inténtalo de nuevo."
};

export default async function NewPetOwnerPage({
  params, searchParams
}: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const profile = await requireOperationalProfile();
  const { id } = await params;
  const queryParams = await searchParams;
  const admin = getSupabaseAdmin();
  let query = admin.from("mascotas").select("id, empresa_id, nombre, numero_carnet, fuente").eq("id", id);
  if (profile.rol !== "super_admin") query = query.eq("empresa_id", profile.empresa_id);
  const { data: pet, error: petError } = await query.maybeSingle();
  if (petError) throw new Error("No fue posible consultar la mascota en Supabase.");
  if (!pet) notFound();

  const save = addOwnerToPet.bind(null, pet.id);

  return (
    <main className="dashboardShell">
      <DashboardHeader profile={profile} context={profile.rol === "super_admin" ? "Superadministrador" : "Operación"} active="mascotas" />
      <section className="dashboardContent registrationContent">
        <Link className="backLink" href={`/mascotas/${pet.id}`}>← Volver a la ficha de {pet.nombre}</Link>
        <p className="eyebrow">Relaciones · Propietarios asociados</p>
        <h1>Agregar otro propietario</h1>
        <p className="description">
          Mascota: <strong>{pet.nombre}</strong> (carnet {pet.numero_carnet || "sin registrar"}).
          Sede de la mascota: <strong>{mostrarSede(pet.fuente)}</strong>.
        </p>
        <p className="description">
          Completa los datos del propietario. PETS buscará primero por documento y teléfono
          en esta empresa: si ya existe, únicamente lo asociará a la mascota.
          Los datos de un propietario existente no se sobrescriben.
        </p>

        {queryParams?.error ? (
          <div className="formAlert">{errors[queryParams.error] || errors.guardar}</div>
        ) : null}

        <form action={save} className="registrationForm">
          <OwnerRegistrationFields initialSede={pet.fuente} />
          <div className="registrationActions">
            <Link className="secondaryLink" href={`/mascotas/${pet.id}`}>Cancelar</Link>
            <button type="submit">Guardar y asociar propietario</button>
          </div>
        </form>
      </section>
    </main>
  );
}
