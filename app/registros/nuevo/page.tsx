import Link from "next/link";

import CarnetGenerator from "@/components/carnet-generator";
import OwnerRegistrationFields from "@/components/owner-registration-fields";
import { especies, razas, temperamentos, estadosReproductivos, tamanos, estadosMascota } from "@/lib/verticals/pets/pet-catalogs";
import DashboardHeader from "@/components/dashboard-header";
import { requireOperationalProfile } from "@/lib/verticals/pets/operational";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createPetRegistration } from "./actions";

const errorMessages: Record<string, string> = {
  empresa: "Selecciona una empresa válida.",
  propietario: "Completa nombre, WhatsApp y correo electrónico del propietario.",
  mascota: "Completa nombre, especie y número de carnet de la mascota.",
  carnet: "El carnet debe contener exactamente 14 números.",
  carnet_repetido: "Ese número de carnet ya está en uso. Genera uno nuevo.",
  documento: "Completa el tipo y el número de documento.",
  notificaciones: "Selecciona Sí o No en ambos permisos de recordatorios.",
  sede: "Selecciona una sede válida.",
  guardar: "No fue posible guardar el registro en Supabase. Comprueba que aplicaste la migración 006."
};

export default async function NewRegistrationPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const profile = await requireOperationalProfile();
  const params = await searchParams;
  const admin = getSupabaseAdmin();
  const companies = profile.rol === "super_admin"
    ? (await admin.from("empresas").select("id, nombre").eq("activa", true).order("nombre")).data || []
    : [];

  return (
    <main className="dashboardShell">
      <DashboardHeader profile={profile} context={profile.rol === "super_admin" ? "Superadministrador" : "Operación"} active="registro" />
      <section className="dashboardContent registrationContent">
        <Link className="backLink" href="/mascotas">← Volver a mascotas</Link>
        <p className="eyebrow">Nuevo registro</p>
        <h1>Propietario y mascota</h1>
        <p className="description">Crea el propietario y la mascota directamente en Supabase, sin formularios externos.</p>

        {params?.error ? <div className="formAlert">{errorMessages[params.error] || errorMessages.guardar}</div> : null}

        <form action={createPetRegistration} className="registrationForm">
          {profile.rol === "super_admin" ? (
            <section className="registrationSection">
              <h2>Empresa</h2>
              <label>Empresa<select name="empresa_id" required defaultValue=""><option value="" disabled>Selecciona una empresa</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.nombre}</option>)}</select></label>
            </section>
          ) : null}

          <OwnerRegistrationFields />

          <section className="registrationSection">
            <div className="sectionHeading"><div><span>2</span><h2>Datos de la mascota</h2></div><small>La mascota se guardará únicamente en PETS.</small></div>
            <div className="registrationGrid">
              <label>Nombre<input name="mascota_nombre" maxLength={120} required /></label>
              <label>Especie<select name="especie" defaultValue="" required><option value="" disabled>Selecciona una especie</option>{especies.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
              <label>Raza<select name="raza" defaultValue=""><option value="">Selecciona una raza</option>{razas.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
              <label>Sexo<select name="sexo" defaultValue=""><option value="">Selecciona una opción</option><option>Hembra</option><option>Macho</option><option>Sin determinar</option></select></label>
              <label>Fecha de nacimiento<input name="fecha_nacimiento" type="date" /></label>
              <label>Color<input name="color" maxLength={80} /></label>
              <label>Peso (kg)<input name="peso_kg" type="number" min="0" step="0.01" /></label>
              <label>Temperamento<select name="temperamento" defaultValue=""><option value="">Selecciona una opción</option>{temperamentos.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
              <label>Estado reproductivo<select name="estado_reproductivo" defaultValue=""><option value="">Selecciona una opción</option>{estadosReproductivos.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
              <label>Número de partos<input name="numero_partos" type="number" min="0" step="1" /></label>
              <label>Tamaño<select name="tamano" defaultValue=""><option value="">Selecciona una opción</option>{tamanos.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
              <label>Estado<select name="estado" defaultValue="Activo">{estadosMascota.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
              <label className="carnetField">Número de carnet<div><input id="numero_carnet" name="numero_carnet" inputMode="numeric" pattern="[0-9]{14}" maxLength={14} required /><CarnetGenerator /></div><small>Formato automático: día, mes, año, hora, minuto y segundo de Bogotá.</small></label>
            </div>
          </section>

          <div className="registrationActions"><Link className="secondaryLink" href="/mascotas">Cancelar</Link><button type="submit">Guardar propietario y mascota</button></div>
        </form>
      </section>
    </main>
  );
}
