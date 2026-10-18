import Link from "next/link";

import DashboardHeader from "@/components/dashboard-header";
import ImportSubmitButton from "@/components/import-submit-button";
import Pagination from "@/components/pagination";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  applyCompanyScope,
  formatDate,
  requireOperationalProfile,
  sanitizeSearch
} from "@/lib/verticals/pets/operational";
import { importPets } from "./actions";
import { mostrarSede } from "@/lib/verticals/pets/sede-display";

export const maxDuration = 60;

const allowedLimits = [10, 25, 50, 100];
const allowedSorts = new Set(["nombre", "numero_carnet", "raza", "sexo", "fecha_nacimiento", "estado"]);

function getOwners(pet) {
  return (pet.propietarios_mascotas || [])
    .map((relation) => relation.propietarios)
    .filter(Boolean);
}

export default async function PetsPage({ searchParams }) {
  const profile = await requireOperationalProfile();
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params?.page || "1", 10) || 1);
  const requestedLimit = Number.parseInt(params?.limit || "10", 10);
  const limit = allowedLimits.includes(requestedLimit) ? requestedLimit : 10;
  const q = sanitizeSearch(params?.q);
  const sort = allowedSorts.has(params?.sort) ? params.sort : "nombre";
  const dir = params?.dir === "desc" ? "desc" : "asc";
  const offset = (page - 1) * limit;
  const admin = getSupabaseAdmin();

  let query = admin
    .from("mascotas")
    .select(
      `id, empresa_id, nombre, numero_carnet, raza, especie, sexo,
       fecha_nacimiento, fecha_fallecimiento, estado, fuente,
       propietarios_mascotas(propietarios(id, nombre, telefono, whatsapp))`,
      { count: "exact" }
    );

  query = applyCompanyScope(query, profile);
  if (q) {
    query = query.or(`nombre.ilike.%${q}%,numero_carnet.ilike.%${q}%,raza.ilike.%${q}%,especie.ilike.%${q}%`);
  }

  const { data: pets = [], count = 0, error: petsError } = await query
    .order(sort, { ascending: dir === "asc", nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (petsError) console.error("Error al leer mascotas", { code: petsError.code, message: petsError.message });
  const companies = profile.rol === "super_admin"
    ? (await admin.from("empresas").select("id, nombre").eq("activa", true).order("nombre")).data || []
    : [];
  const totalPages = Math.max(1, Math.ceil((count || 0) / limit));

  return (
    <main className="dashboardShell">
      <DashboardHeader
        profile={profile}
        context={profile.rol === "super_admin" ? "Superadministrador" : "Operación"}
        active="mascotas"
      />

      <section className="dashboardContent wideContent">
        <div className="listTitleRow">
          <div>
            <p className="eyebrow">Gestión operativa</p>
            <h1>Mascotas</h1>
            <p className="description">Consulta la base de mascotas y abre cada ficha clínica.</p>
          </div>
          <div className="listActions">
            <Link className="actionLink" href="/registros/nuevo">Nueva mascota</Link>
            <Link className="actionLink" href="/api/export/mascotas">Descargar Excel</Link>
            {profile.rol === "super_admin" ? (
              <details className="uploadPanel">
                <summary>Subir archivo</summary>
                <form action={importPets} className="uploadForm">
                  <label>Empresa
                    <select name="empresa_id" required defaultValue="">
                      <option value="" disabled>Selecciona una empresa</option>
                      {companies.map((company) => <option key={company.id} value={company.id}>{company.nombre}</option>)}
                    </select>
                  </label>
                  <label>Archivo .xlsx o .csv<input name="archivo" type="file" accept=".xlsx,.csv,text/csv" required /></label>
                  <ImportSubmitButton
                    idleLabel="Importar mascotas"
                    pendingLabel="Importando mascotas..."
                  />
                  <small>Importa primero las mascotas y después los propietarios. No se permiten carnets repetidos.</small>
                </form>
              </details>
            ) : null}
          </div>
        </div>

        {params?.ok === "importado" ? (
          <div className="successAlert">
            Se importaron {Number(params?.importados) || 0} mascotas.
            {Number(params?.omitidos) ? ` Se omitieron ${Number(params.omitidos)} registros que ya existían o no tenían nombre.` : ""}
          </div>
        ) : null}
        {params?.error === "carnets_repetidos" ? (
          <div className="formAlert">
            El archivo tiene {Number(params?.conflictos) || 1} carnet repetido. Corrige el mismo carnet en los archivos de mascotas y propietarios antes de importar.
          </div>
        ) : params?.error ? (
          <div className="formAlert">No fue posible importar el archivo. Revisa el formato y vuelve a intentarlo.</div>
        ) : null}

        <div className="tableToolbar">
          <form className="rowsForm">
            <label>Mostrar
              <select name="limit" defaultValue={String(limit)}>
                {allowedLimits.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              registros por página
            </label>
            {q ? <input type="hidden" name="q" value={q} /> : null}
            <button className="buttonSecondary" type="submit">Aplicar</button>
          </form>
          <form className="searchForm">
            <label>Buscar:<input name="q" defaultValue={q} /></label>
            <input type="hidden" name="limit" value={limit} />
            <button type="submit">Buscar</button>
          </form>
        </div>

        {petsError ? <div className="formAlert">No fue posible cargar las mascotas desde Supabase. Revisa la conexión y el campo fuente.</div> : null}
        <div className="dataTableWrap">
          <table className="dataTable">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>No. carnet</th>
                <th>Tipo (raza)</th>
                <th>Sexo</th>
                <th>Fecha de nacimiento</th>
                <th>Propietarios</th>
                <th>Teléfono</th>
                <th>SEDE</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pets.length ? pets.map((pet) => {
                const owners = getOwners(pet);
                return (
                  <tr key={pet.id}>
                    <td><Link href={`/mascotas/${pet.id}`}>{pet.nombre}</Link></td>
                    <td>{pet.numero_carnet || "—"}</td>
                    <td>{[pet.raza, pet.especie].filter(Boolean).join(" (")}{pet.raza && pet.especie ? ")" : ""}</td>
                    <td>{pet.sexo || "—"}</td>
                    <td>{formatDate(pet.fecha_nacimiento)}</td>
                    <td>{owners.length ? owners.map((owner, index) => (
                      <span key={owner.id}>{index ? ", " : ""}<Link href={`/propietarios/${owner.id}`}>{owner.nombre}</Link></span>
                    )) : "Sin asociar"}</td>
                    <td>{owners.map((owner) => owner.whatsapp || owner.telefono).filter(Boolean).join(" - ") || "—"}</td>
                    <td>{mostrarSede(pet.fuente)}</td>
                    <td>{pet.estado || (pet.fecha_fallecimiento ? "Fallecido" : "Activo")}</td>
                    <td><Link className="tableAction" href={`/mascotas/${pet.id}`}>Ver ficha</Link></td>
                  </tr>
                );
              }) : (
                <tr><td className="tableEmpty" colSpan={10}>No hay mascotas para mostrar.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="tableFooter"><span>{count || 0} mascotas</span></div>
        <Pagination basePath="/mascotas" page={Math.min(page, totalPages)} totalPages={totalPages} query={{ q, limit, sort, dir }} />
      </section>
    </main>
  );
}
