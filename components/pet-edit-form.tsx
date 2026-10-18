// @ts-nocheck — lógica/props PETS aún requieren tipado estricto.
import {
  sedes, especies, razas, temperamentos, estadosReproductivos, tamanos, estadosMascota
} from "@/lib/verticals/pets/pet-catalogs";
import { updatePetProfile } from "@/app/mascotas/[id]/profile-actions";

function Choice({ label, name, current, values, required = false }) {
  const options = current && !values.includes(current) ? [current, ...values] : values;
  return (
    <label>{label}
      <select name={name} defaultValue={current || ""} required={required}>
        {!required ? <option value="">Sin especificar</option> : null}
        {required && !current ? <option value="" disabled>Selecciona una opción</option> : null}
        {options.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
    </label>
  );
}

export default function PetEditForm({ pet, editing = false, error = false, success = false }) {
  const save = updatePetProfile.bind(null, pet.id);
  return (
    <section className="recordSection">
      {success ? <div className="successAlert">La información de la mascota se actualizó correctamente.</div> : null}
      <details className="profileEditPanel" open={editing ? true : undefined}>
        <summary>Editar datos de la mascota</summary>
        {error ? <div className="formAlert">No se pudo actualizar. Revisa datos, duplicados de carnet y la migración 006.</div> : null}
        <form action={save} className="registrationForm">
          <div className="registrationGrid">
            <label>Nombre<input name="nombre" required defaultValue={pet.nombre || ""} maxLength={120} /></label>
            <label>Número de carnet<input name="numero_carnet" defaultValue={pet.numero_carnet || ""} maxLength={100} /></label>
            <Choice label="SEDE" name="fuente" values={sedes} current={pet.fuente} />
            <Choice label="Estado" name="estado" values={estadosMascota} current={pet.estado || "Activo"} required />
            <Choice label="Especie" name="especie" values={especies} current={pet.especie} />
            <Choice label="Raza" name="raza" values={razas} current={pet.raza} />
            <Choice label="Temperamento" name="temperamento" values={temperamentos} current={pet.temperamento} />
            <Choice label="Estado reproductivo" name="estado_reproductivo" values={estadosReproductivos} current={pet.estado_reproductivo} />
            <Choice label="Tamaño" name="tamano" values={tamanos} current={pet.tamano} />
            <Choice label="Sexo" name="sexo" values={["Hembra", "Macho", "Sin determinar"]} current={pet.sexo} />
            <label>Fecha de nacimiento<input type="date" name="fecha_nacimiento" defaultValue={pet.fecha_nacimiento || ""} /></label>
            <label>Color<input name="color" defaultValue={pet.color || ""} /></label>
            <label>Peso (kg)<input type="number" min="0" step="0.01" name="peso_kg" defaultValue={pet.peso_kg ?? ""} /></label>
            <label>Número de partos<input type="number" min="0" step="1" name="numero_partos" defaultValue={pet.numero_partos ?? ""} /></label>
            <label>Fecha de fallecimiento<input type="date" name="fecha_fallecimiento" defaultValue={pet.fecha_fallecimiento || ""} /></label>
            <label className="fullField">Motivo del fallecimiento<textarea name="motivo_fallecimiento" defaultValue={pet.motivo_fallecimiento || ""} rows="3" /></label>
            <label className="fullField">Comentarios del fallecimiento<textarea name="comentarios_fallecimiento" defaultValue={pet.comentarios_fallecimiento || ""} rows="3" /></label>
          </div>
          <div className="registrationActions"><button type="submit">Actualizar datos</button></div>
        </form>
      </details>
    </section>
  );
}
