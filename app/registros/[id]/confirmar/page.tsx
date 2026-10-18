import Link from "next/link";
import { notFound } from "next/navigation";

import DashboardHeader from "@/components/dashboard-header";
import RegistrationConfirmation from "@/components/registration-confirmation";
import { requireOperationalProfile } from "@/lib/verticals/pets/operational";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type ConfirmationRegistration = {
  id: string; propietario?: Record<string, string | null> | null;
};
function buildFormUrl(baseUrl: string, registration: ConfirmationRegistration): string {
  const owner = registration.propietario || {};
  const url = new URL(baseUrl);
  const values = {
    nombre: owner.nombre,
    apellido: owner.apellido,
    phone: owner.whatsapp,
    telefono: owner.telefono,
    correo_electronico: owner.correo_electronico,
    ciudad: owner.ciudad,
    direccion: owner.direccion,
    tipo_de_documento: owner.tipo_documento,
    numero_de_documento: owner.numero_documento,
    notificacion_email: owner.notificacion_email,
    notificacion_whatsapp: owner.notificacion_whatsapp,
    pets_registro_id: registration.id
  };

  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export default async function ConfirmRegistrationPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireOperationalProfile();
  const { id } = await params;
  const admin = getSupabaseAdmin();
  const { data: registration } = await admin
    .from("registros_mascotas_pendientes")
    .select("id, empresa_id, propietario, mascota, numero_carnet, estado")
    .eq("id", id)
    .maybeSingle();

  if (!registration || (profile.rol !== "super_admin" && registration.empresa_id !== profile.empresa_id)) {
    notFound();
  }

  const { data: integration } = await admin
    .from("integraciones_contacto")
    .select("formulario_url, activa")
    .eq("empresa_id", registration.empresa_id)
    .maybeSingle();

  if (!integration?.activa) notFound();
  const pet = registration.mascota || {};

  return (
    <main className="dashboardShell">
      <DashboardHeader profile={profile} context={profile.rol === "super_admin" ? "Superadministrador" : "Operación"} active="registro" />
      <section className="dashboardContent wideContent confirmationContent">
        <Link className="backLink" href="/registros/nuevo">← Corregir datos en PETS</Link>
        <p className="eyebrow">Paso final</p>
        <h1>Confirmar propietario</h1>
        <div className="petConfirmationSummary"><div><span>Mascota</span><strong>{pet.nombre}</strong></div><div><span>Especie</span><strong>{pet.especie || "—"}</strong></div><div><span>Carnet</span><strong>{registration.numero_carnet}</strong></div></div>
        <RegistrationConfirmation
          registrationId={registration.id}
          formUrl={buildFormUrl(integration.formulario_url, registration)}
          initialStatus={registration.estado}
        />
      </section>
    </main>
  );
}
