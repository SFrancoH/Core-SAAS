// @ts-nocheck — lógica/props PETS aún requieren tipado estricto.
import { sedes } from "@/lib/verticals/pets/pet-catalogs";
import { updateOwnerProfile } from "@/app/propietarios/[id]/actions";

export default function OwnerEditForm({ owner, editing, error, success }) {
  const selected = owner.fuente && !sedes.includes(owner.fuente) ? [owner.fuente, ...sedes] : sedes;
  return (
    <section className="recordSection">
      {success ? <div className="successAlert">El propietario fue actualizado.</div> : null}
      <details className="profileEditPanel" open={editing ? true : undefined}>
        <summary>Editar datos del propietario</summary>
        {error ? <div className="formAlert">No fue posible actualizar el propietario; revisa los datos ingresados.</div> : null}
        <form action={updateOwnerProfile.bind(null, owner.id)} className="registrationForm">
          <div className="registrationGrid">
            <label>Nombre<input name="nombre" defaultValue={owner.nombre || ""} maxLength={120} required /></label>
            <label>SEDE<select name="fuente" defaultValue={owner.fuente || ""}>
              <option value="">Sin sede registrada</option>{selected.map((s) => <option key={s} value={s}>{s}</option>)}
            </select></label>
            <label>Ciudad<input name="ciudad" defaultValue={owner.ciudad || ""} /></label>
            <label>Dirección<input name="direccion" defaultValue={owner.direccion || ""} /></label>
            <label>Teléfono<input name="telefono" defaultValue={owner.telefono || ""} /></label>
            <label>WhatsApp<input name="whatsapp" defaultValue={owner.whatsapp || ""} /></label>
            <label>Email<input name="email" type="email" defaultValue={owner.email || ""} /></label>
            <label>Tipo de documento<input name="tipo_documento" defaultValue={owner.tipo_documento || ""} /></label>
            <label>Número de documento<input name="numero_documento" defaultValue={owner.numero_documento || ""} /></label>
            <label>Estado<select name="estado" defaultValue={owner.estado || "Activo"}>
              <option>Activo</option><option>Inactivo</option>
            </select></label>
            <label>Recordatorios WhatsApp<select name="notificaciones_whatsapp" defaultValue={owner.notificaciones_whatsapp ? "si" : "no"}>
              <option value="si">Sí</option><option value="no">No</option>
            </select></label>
            <label className="fullField">Tags (separados por coma)<input name="tags" defaultValue={(owner.tags || []).join(", ")} /></label>
          </div>
          <div className="registrationActions"><button type="submit">Actualizar datos</button></div>
        </form>
      </details>
    </section>
  );
}
