// @ts-nocheck — pendiente tipar lógica heredada PETS.
import Link from "next/link";
import { notFound } from "next/navigation";

import ConsultationControlPanel from "@/components/consultation-control-panel";
import DashboardHeader from "@/components/dashboard-header";
import PetEditForm from "@/components/pet-edit-form";
import { mostrarSede } from "@/lib/verticals/pets/sede-display";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { formatDate, requireOperationalProfile } from "@/lib/verticals/pets/operational";

export default async function PetDetailPage({ params, searchParams }) {
  const profile = await requireOperationalProfile();
  const { id } = await params;
  const queryParams = await searchParams;
  const admin = getSupabaseAdmin();
  let query = admin
    .from("mascotas")
    .select(`*, empresas(nombre), propietarios_mascotas(propietarios(id, nombre, telefono, whatsapp, email, numero_documento))`)
    .eq("id", id);
  if (profile.rol !== "super_admin") query = query.eq("empresa_id", profile.empresa_id);
  const { data: pet, error: petError } = await query.maybeSingle();
  if (petError) {
    console.error("Error al consultar mascota", { code: petError.code, message: petError.message });
    throw new Error("No fue posible consultar la mascota en Supabase.");
  }
  if (!pet) notFound();

  const historyOpen = queryParams?.historial === "1";
  const historyPage = Math.max(1, Number.parseInt(queryParams?.pagina || "1", 10) || 1);
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const historyFrom = datePattern.test(queryParams?.desde || "") ? queryParams.desde : "";
  const historyTo = datePattern.test(queryParams?.hasta || "") ? queryParams.hasta : "";
  // Una consulta como máximo para la pestaña de consulta y control.
  const recentConsultationQuery = admin.from("consultas_controles")
    .select("*").eq("empresa_id", pet.empresa_id).eq("mascota_id", pet.id)
    .order("fecha_registro", { ascending: false }).order("id", { ascending: false }).limit(1);
  let eventsQuery = admin.from("eventos_mascota")
    .select("id, modulo, consulta_id, fecha_registro, resumen", { count: "exact" })
    .eq("empresa_id", pet.empresa_id).eq("mascota_id", pet.id);
  if (historyFrom) eventsQuery = eventsQuery.gte("fecha_registro", `${historyFrom}T00:00:00-05:00`);
  if (historyTo) eventsQuery = eventsQuery.lte("fecha_registro", `${historyTo}T23:59:59.999-05:00`);
  const pageLimit = 50;
  const offset = (historyPage - 1) * pageLimit;
  const [veterinariansResult, consultationsResult, procedureSchemaResult, latestModulesResult, eventsResult] = await Promise.all([
    admin.from("usuarios").select("id, nombre, rol, empresa_id")
      .eq("empresa_id", pet.empresa_id).eq("rol", "veterinario")
      .eq("activo", true).order("nombre"),
    recentConsultationQuery,
    admin.from("consultas_controles").select("procedimientos_habilitados").limit(1),
    admin.rpc("ultimos_eventos_mascota_pets", { p_empresa_id: pet.empresa_id, p_mascota_id: pet.id }),
    historyOpen
      ? eventsQuery.order("fecha_registro", { ascending: false }).order("id", { ascending: false })
          .range(offset, offset + pageLimit - 1)
      : Promise.resolve({ data: [], count: 0, error: null })
  ]);
  const loadedEvents = eventsResult.data || [];
  const consultationIds = [...new Set(loadedEvents.map((event) => event.consulta_id).filter(Boolean))];
  const relatedResult = consultationIds.length
    ? await admin.from("consultas_controles").select("*").eq("empresa_id", pet.empresa_id)
        .eq("mascota_id", pet.id).in("id", consultationIds)
    : { data: [], error: null };
  const consultationsById = new Map((relatedResult.data || []).map((item) => [item.id, item]));
  const historyEntries = loadedEvents.map((event) => ({
    ...event, consulta: consultationsById.get(event.consulta_id) || null
  }));
  const veterinarians = [...(veterinariansResult.data || [])];
  if (profile.rol === "super_admin" && !veterinarians.some((vet) => vet.id === profile.id)) {
    veterinarians.unshift({
      id: profile.id,
      nombre: profile.nombre,
      rol: profile.rol,
      empresa_id: null
    });
  }
  const historyAvailable = !consultationsResult.error;
  const consultations = consultationsResult.data || [];
  const owners = (pet.propietarios_mascotas || []).map((relation) => relation.propietarios).filter(Boolean);
  const details = [
    ["Número de carnet", pet.numero_carnet],
    ["Especie", pet.especie],
    ["Raza", pet.raza],
    ["Sexo", pet.sexo],
    ["Peso", pet.peso_kg !== null ? `${pet.peso_kg} kg` : null],
    ["Tamaño", pet.tamano],
    ["Fecha de nacimiento", formatDate(pet.fecha_nacimiento)],
    ["Color", pet.color],
    ["Temperamento", pet.temperamento],
    ["Estado reproductivo", pet.estado_reproductivo],
    ["Número de partos", pet.numero_partos],
    ["Estado", pet.estado],
    ["SEDE", mostrarSede(pet.fuente)],
    ["Fecha de fallecimiento", formatDate(pet.fecha_fallecimiento)],
    ["Motivo de fallecimiento", pet.motivo_fallecimiento],
    ["Comentarios del fallecimiento", pet.comentarios_fallecimiento]
  ];

  return (
    <main className="dashboardShell">
      <DashboardHeader profile={profile} context={profile.rol === "super_admin" ? "Superadministrador" : "Operación"} active="mascotas" />
      <section className="dashboardContent wideContent">
        <Link className="backLink" href="/mascotas">← Volver a mascotas</Link>
        <div className="recordHeading">
          <div>
            <p className="eyebrow">Ficha de mascota</p>
            <h1>{pet.nombre}</h1>
            <p className="description">SEDE: {mostrarSede(pet.fuente)}</p>
          </div>
          <span className={pet.estado === "Activo" ? "badgeActive" : "badgeInactive"}>
            {pet.estado || (pet.fecha_fallecimiento ? "Fallecido" : "Activo")}
          </span>
        </div>

        <ConsultationControlPanel
          pet={{
            id: pet.id,
            nombre: pet.nombre,
            numero_carnet: pet.numero_carnet,
            especie: pet.especie,
            raza: pet.raza,
            sexo: pet.sexo,
            fecha_nacimiento_formateada: formatDate(pet.fecha_nacimiento),
            estado_reproductivo: pet.estado_reproductivo,
            color: pet.color,
            peso_kg: pet.peso_kg,
            tamano: pet.tamano,
            propietarios: owners.map((owner) => owner.nombre)
          }}
          veterinarians={veterinarians}
          actor={{ id: profile.id, nombre: profile.nombre, rol: profile.rol }}
          consultations={consultations}
          latestConsultation={consultations[0] || null}
          latestModules={latestModulesResult.data || []}
          historyEntries={historyEntries}
          eventSchemaReady={!latestModulesResult.error && !eventsResult.error && !relatedResult.error}
          historyOpen={historyOpen}
          historyPage={historyPage}
          historyTotal={eventsResult.count || 0}
          historyFrom={historyFrom}
          historyTo={historyTo}
          historyAvailable={historyAvailable}
          procedureSchemaReady={!procedureSchemaResult.error}
          recordedAt={new Date().toISOString()}
          initialModule={queryParams?.modulo === "consulta-control" ? "consulta-control" : "historia"}
          initialView={queryParams?.vista === "nueva" ? "new" : "history"}
          success={queryParams?.ok || ""}
          error={queryParams?.error || ""}
        />

        <section className="recordSection">
          <p className="eyebrow">Información general</p>
          <h2>Detalles de la mascota</h2>
          <dl className="detailGrid">
            {details.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value === null || value === undefined || value === "" ? "—" : value}</dd></div>
            ))}
          </dl>
        </section>

        <PetEditForm pet={pet} editing={queryParams?.editar === "1"} error={queryParams?.error_perfil === "1"} success={queryParams?.perfil_actualizado === "1"} />

        <section className="recordSection">
          <p className="eyebrow">Relaciones</p>
          <div className="associationHeading">
            <h2>Propietarios asociados</h2>
            <Link className="actionLink" href={`/mascotas/${pet.id}/propietarios/nuevo`}>Agregar otro propietario</Link>
          </div>
          {queryParams?.propietario === "creado_y_asociado" ? (
            <div className="successAlert">Se creó el propietario y se asoció a esta mascota.</div>
          ) : queryParams?.propietario === "existente_asociado" ? (
            <div className="successAlert">El propietario ya existía y fue asociado sin duplicarlo.</div>
          ) : queryParams?.propietario === "ya_asociado" ? (
            <div className="successAlert">Este propietario ya estaba asociado a la mascota. No se duplicó la relación.</div>
          ) : null}
          <div className="associationGrid">
            {owners.length ? owners.map((owner) => (
              <Link className="associationCard" href={`/propietarios/${owner.id}`} key={owner.id}>
                <strong>{owner.nombre}</strong>
                <span>{owner.whatsapp || owner.telefono || "Sin teléfono"}</span>
                <small>{owner.email || owner.numero_documento || "Ver propietario"}</small>
              </Link>
            )) : <div className="emptyState"><h2>Sin propietarios asociados</h2><p>Esta mascota todavía no tiene propietarios vinculados.</p></div>}
          </div>
        </section>
      </section>
    </main>
  );
}
