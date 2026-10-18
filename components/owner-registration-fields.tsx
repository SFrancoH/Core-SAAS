// @ts-nocheck — lógica/props PETS aún requieren tipado estricto.
import { sedes } from "@/lib/verticals/pets/pet-catalogs";

const documentTypes = [
  "Cédula de ciudadania",
  "Cédula extranjera",
  "NIT",
  "RUT",
  "CURP",
  "Tarjeta de identidad nacional",
  "Pasaporte",
  "Documento de identidad internacional"
];

// Bloque compartido por Nuevo registro y Agregar otro propietario.
// No incluye información de mascotas: el formulario que lo usa decide el destino.
export default function OwnerRegistrationFields({ initialSede = "", step = "1" }) {
  const sedeDefault = sedes.includes(initialSede) ? initialSede : "";
  return (
    <section className="registrationSection">
      <div className="registrationGrid ownerSedeField">
        <label>SEDE
          <select name="fuente" required defaultValue={sedeDefault}>
            <option value="" disabled>Selecciona una sede</option>
            {sedes.map((sede) => <option key={sede} value={sede}>{sede}</option>)}
          </select>
        </label>
      </div>
      <div className="sectionHeading">
        <div><span>{step}</span><h2>Datos del propietario</h2></div>
        <small>Los datos del propietario se guardan directamente en PETS.</small>
      </div>
      <div className="registrationGrid">
        <label>Nombre<input name="nombre" maxLength={80} required /></label>
        <label>Apellido<input name="apellido" maxLength={80} /></label>
        <label>WhatsApp<input name="whatsapp" type="tel" maxLength={40} required /></label>
        <label>Teléfono alterno<input name="telefono" type="tel" maxLength={40} /></label>
        <label>Correo electrónico<input name="correo_electronico" type="email" maxLength={160} required /></label>
        <label>Ciudad<input name="ciudad" maxLength={100} /></label>
        <label className="fullField">Dirección<input name="direccion" maxLength={220} /></label>
        <label>Tipo de documento
          <select name="tipo_documento" required defaultValue="">
            <option value="" disabled>Selecciona una opción</option>
            {documentTypes.map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label>Número de documento<input name="numero_documento" maxLength={80} required /></label>
        <fieldset className="choiceField">
          <legend>¿Acepta recordatorios por correo electrónico?</legend>
          <label><input type="radio" name="notificacion_email" value="Si" required /> Sí</label>
          <label><input type="radio" name="notificacion_email" value="No" required /> No</label>
        </fieldset>
        <fieldset className="choiceField">
          <legend>¿Acepta recordatorios por WhatsApp?</legend>
          <label><input type="radio" name="notificacion_whatsapp" value="Si" required /> Sí</label>
          <label><input type="radio" name="notificacion_whatsapp" value="No" required /> No</label>
        </fieldset>
      </div>
    </section>
  );
}
