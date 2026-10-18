"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { createConsultation, updateConsultation } from "@/app/mascotas/[id]/actions";
import Link from "next/link";
import {
  administrationRoutes,
  medicationFrequencies,
  medications as medicationCatalog,
  procedureTypes
} from "@/lib/verticals/pets/clinical-catalogs";

export type ClinicalPet = {
  id: string; nombre: string; numero_carnet?: string | null;
  especie?: string | null; raza?: string | null; sexo?: string | null;
  tamano?: string | null; fecha_nacimiento_formateada?: string | null;
  estado_reproductivo?: string | null; color?: string | null;
  peso_kg?: number | null; propietarios?: string[];
};
export type ClinicalActor = { id: string; nombre: string; rol: string };
export type ClinicalVeterinarian = { id: string; nombre: string; rol?: string; empresa_id?: string | null };
type MedicationValues = {
  medicamento: string; medicamento_otro: string;
  dosis_terapeutica: string; via_administracion: string;
  via_administracion_otra: string; frecuencia: string;
  frecuencia_otra: string; cantidad_total: string | number;
};
type MedicationRow = MedicationValues & { id: number };
export type ClinicalConsultation = {
  id: string; fecha_registro: string; updated_at?: string | null;
  tipo_servicio?: string | null; medico_veterinario_id?: string | null;
  medico_veterinario_nombre?: string | null; medico_registra_nombre?: string | null;
  motivo_cita?: string | null; anamnesis?: string | null; tipo_alimento?: string | null;
  tipo_alimento_otro?: string | null; heces?: string | null; heces_otro?: string | null;
  racion?: string | null; orina?: string | null;
  frecuencia_cardiaca?: number | null; frecuencia_respiratoria?: number | null;
  temperatura_c?: number | null; tllc_segundos?: number | null;
  pulso?: string | null; peso_actual_kg?: number | null;
  actitud?: string | null; condicion_corporal?: string | null;
  revision_sistemas?: Record<string, { estado?: string | null; detalle?: string | null }> | null;
  comentarios_observaciones?: string | null;
  lista_problemas?: string | null; diagnostico_diferencial?: string | null;
  diagnostico_presuntivo?: string | null; examenes_laboratorio?: string | null;
  imagenes_diagnosticas?: string | null; diagnostico_definitivo?: string | null;
  tratamiento?: string | null; pronostico?: string | null; notas?: string | null;
  procedimientos_habilitados?: boolean | null; procedimientos?: string | null;
  area_consulta?: string | null; valor_total_servicio?: number | null;
  tipos_procedimiento?: string[] | null; observaciones_procedimiento?: string | null;
  formula_descripcion?: string | null; formula_medicamentos?: MedicationValues[] | null;
  habilitar_observacion?: boolean | null;
};
type LatestModule = { modulo: string; fecha_registro: string; resumen?: string | null };
export type PetHistoryEntry = {
  id: string; modulo: string; fecha_registro: string; resumen?: string | null;
  consulta: ClinicalConsultation | null;
};
type CommonProps = { pet: ClinicalPet; veterinarians: ClinicalVeterinarian[]; actor: ClinicalActor;
  procedureSchemaReady: boolean };
type ProcedureProps = Pick<CommonProps, "pet" | "actor"> & {
  recordedAt: string; initial?: Partial<ClinicalConsultation>;
};
type FormProps = CommonProps & {
  recordedAt: string; onCancel: () => void;
  initialConsultation?: ClinicalConsultation | null; readOnly?: boolean;
};
type EntryProps = CommonProps & {
  consultation: ClinicalConsultation; moduleLabel?: string | null;
};
type OverviewProps = CommonProps & {
  latestConsultation: ClinicalConsultation | null; latestModules?: LatestModule[];
  historyEntries?: PetHistoryEntry[]; eventSchemaReady: boolean;
  consultations: ClinicalConsultation[]; historyOpen: boolean;
  historyPage: number; historyTotal: number; historyFrom: string; historyTo: string;
};
type PanelProps = OverviewProps & {
  historyAvailable: boolean; recordedAt: string;
  initialModule: "historia" | "consulta-control";
  initialView: "history" | "new";
  success: string; error: string;
};
function narrativeValue(initial: Partial<ClinicalConsultation>, name: string): string {
  const value: unknown = (initial as Record<string, unknown>)[name];
  return typeof value === "string" ? value : "";
}

const modules = [
  ["historia", "Historial de la mascota"],
  ["consulta-control", "Consulta y control"],
  ["formula", "Fórmula y remisión"],
  ["procedimientos", "Procedimientos"],
  ["vacunacion", "Vacunación"],
  ["desparasitacion", "Desparasitación"],
  ["estetica", "Estética"],
  ["guarderia", "Guardería"],
  ["seguimiento", "Seguimiento"],
  ["consentimientos", "Consentimientos"]
];

const systems = [
  ["organos_sentidos", "Órganos de los sentidos"],
  ["ganglios_linfaticos", "Ganglios linfáticos"],
  ["sistema_respiratorio", "Sistema respiratorio"],
  ["sistema_cardiovascular", "Sistema cardiovascular"],
  ["sistema_digestivo", "Sistema digestivo"],
  ["sistema_musculo_esqueletico", "Sistema músculo esquelético"],
  ["piel_pelaje", "Piel y pelaje"],
  ["sistema_neurologico", "Sistema neurológico"],
  ["sistema_urinario", "Sistema urinario"],
  ["sistema_reproductivo", "Sistema reproductivo"]
];

const narrativeSections = [
  ["lista_problemas", "Lista de problemas"],
  ["diagnostico_diferencial", "Diagnóstico diferencial"],
  ["diagnostico_presuntivo", "Diagnóstico presuntivo"],
  ["examenes_laboratorio", "Exámenes de laboratorio solicitados"],
  ["imagenes_diagnosticas", "Imágenes diagnósticas"],
  ["diagnostico_definitivo", "Diagnóstico definitivo"],
  ["tratamiento", "Tratamiento"],
  ["pronostico", "Pronóstico"],
  ["notas", "Notas"]
];

const systemLabels = Object.fromEntries(systems);

function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota"
  }).format(new Date(value));
}

function responsibilityText(name: string): string {
  return `El propietario no cuenta con los recursos económicos y/o no acepta que se realicen las pruebas paraclínicas necesarias para instaurar una terapia, y/o no acepta hospitalización en caso de que se requiera. Por lo tanto, el Dr. ${name} no se hace responsable del paciente, en virtud de que el propietario y/o usuario del servicio no puede cumplir con las recomendaciones indicadas. De esta manera, el propietario y/o usuario del servicio acepta la responsabilidad del paciente.`;
}

function SubmitConsultationButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={disabled || pending} aria-busy={pending}>
      {pending ? <span className="buttonSpinner" aria-hidden="true" /> : null}
      {pending ? "Guardando consulta..." : "Guardar consulta"}
    </button>
  );
}

function ReadonlyField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <label>
      <span>{label}</span>
      <input value={value || "Sin información"} readOnly />
    </label>
  );
}

function newMedicationRow(id: number): MedicationRow {
  return {
    id,
    medicamento: "",
    medicamento_otro: "",
    dosis_terapeutica: "",
    via_administracion: "",
    via_administracion_otra: "",
    frecuencia: "",
    frecuencia_otra: "",
    cantidad_total: "1"
  };
}

function ProcedureBlock({ pet, actor, recordedAt, initial = {} }: ProcedureProps) {
  const [enabled, setEnabled] = useState(initial.procedimientos_habilitados ? "si" : "no");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(initial.tipos_procedimiento || []);
  const [medicationRows, setMedicationRows] = useState<MedicationRow[]>(
    Array.isArray(initial.formula_medicamentos) && initial.formula_medicamentos.length
      ? initial.formula_medicamentos.map((row, index) => ({ ...newMedicationRow(index + 1), ...row, id: index + 1 }))
      : [newMedicationRow(1)]
  );
  const homeTreatmentSelected = selectedTypes.includes("Tratamiento farmacológico en casa");

  function toggleType(type: string, checked: boolean): void {
    setSelectedTypes((current) => checked
      ? [...current, type]
      : current.filter((value) => value !== type));
  }

  function updateMedication(id: number, field: keyof MedicationValues, value: string): void {
    setMedicationRows((current) => current.map((row) => (
      row.id === id ? { ...row, [field]: value } : row
    )));
  }

  function addMedication(): void {
    setMedicationRows((current) => [
      ...current,
      newMedicationRow(Math.max(...current.map((row) => row.id), 0) + 1)
    ]);
  }

  function removeMedication(id: number): void {
    setMedicationRows((current) => current.length > 1
      ? current.filter((row) => row.id !== id)
      : current);
  }

  return (
    <details className="clinicalBlock" open>
      <summary>Procedimientos</summary>
      <div className="clinicalBlockContent procedureBlockContent">
        <fieldset className="procedureToggle">
          <legend>¿Se realizaron procedimientos? (opcional)</legend>
          <div className="radioRow">
            <label>
              <input
                type="radio"
                name="procedimientos_habilitados"
                value="si"
                checked={enabled === "si"}
                onChange={() => setEnabled("si")}
              />
              Sí
            </label>
            <label>
              <input
                type="radio"
                name="procedimientos_habilitados"
                value="no"
                checked={enabled === "no"}
                onChange={() => {
                  setEnabled("no");
                  setSelectedTypes([]);
                }}
              />
              No
            </label>
          </div>
        </fieldset>

        {enabled === "si" ? (
          <>
            <div className="formGrid procedureMetaGrid">
              <label>
                <span>Área de consulta</span>
                <select name="area_consulta" defaultValue={initial.area_consulta || ""} required>
                  <option value="" disabled>Selecciona una opción</option>
                  <option value="Medicación">Medicación</option>
                  <option value="Hospitalización">Hospitalización</option>
                </select>
              </label>
              <label>
                <span>Valor total del servicio</span>
                <input name="valor_total_servicio" type="number" min="0" step="0.01" defaultValue={initial.valor_total_servicio ?? ""} />
              </label>
            </div>

            <fieldset className="procedureChoices">
              <legend>Tipo de procedimiento</legend>
              <div className="procedureChoiceGrid">
                {procedureTypes.map((type) => (
                  <label key={type}>
                    <input
                      type="checkbox"
                      name="tipos_procedimiento"
                      value={type}
                      checked={selectedTypes.includes(type)}
                      onChange={(event) => toggleType(type, event.target.checked)}
                    />
                    <span>{type}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="stackedField">
              <span>Observaciones</span>
              <textarea name="observaciones_procedimiento" rows={4} defaultValue={initial.observaciones_procedimiento || ""} />
            </label>

            {homeTreatmentSelected ? (
              <section className="prescriptionCard" aria-labelledby="prescription-title">
                <div className="prescriptionHeading">
                  <div>
                    <p className="eyebrow">Tratamiento farmacológico en casa</p>
                    <h3 id="prescription-title">Registrar fórmula</h3>
                  </div>
                  <span>Médico veterinario: <strong>{initial.medico_registra_nombre || actor.nombre}</strong></span>
                </div>

                <div className="prescriptionPatientGrid">
                  <ReadonlyField label="Número de historia" value={pet.numero_carnet} />
                  <ReadonlyField label="Fecha de registro" value={formatDateTime(recordedAt)} />
                  <ReadonlyField label="Propietario" value={pet.propietarios?.join(", ")} />
                  <ReadonlyField label="Mascota" value={pet.nombre} />
                  <ReadonlyField label="Especie" value={pet.especie} />
                  <ReadonlyField label="Raza" value={pet.raza} />
          <ReadonlyField label="Tamaño" value={pet.tamano} />
                  <ReadonlyField label="Sexo" value={pet.sexo} />
                  <ReadonlyField label="Peso actual" value={pet.peso_kg !== null ? `${pet.peso_kg} kg` : null} />
                </div>

                <label className="stackedField prescriptionDescription">
                  <span>Descripción</span>
                  <textarea name="formula_descripcion" rows={4} placeholder="Indicaciones generales para el tratamiento en casa" defaultValue={initial.formula_descripcion || ""} />
                </label>

                <input
                  type="hidden"
                  name="formula_medicamentos"
                  value={JSON.stringify(medicationRows.map(({ id, ...row }) => row))}
                />

                <div className="medicationList">
                  {medicationRows.map((row, index) => (
                    <div className="medicationRow" key={row.id}>
                      <div className="medicationRowHeading">
                        <strong>Medicamento {index + 1}</strong>
                        {medicationRows.length > 1 ? (
                          <button
                            className="removeMedicationButton"
                            type="button"
                            onClick={() => removeMedication(row.id)}
                            aria-label={`Eliminar medicamento ${index + 1}`}
                          >
                            Eliminar
                          </button>
                        ) : null}
                      </div>
                      <div className="medicationFields">
                        <label className="medicationNameField">
                          <span>Medicamento</span>
                          <select
                            value={row.medicamento}
                            onChange={(event) => updateMedication(row.id, "medicamento", event.target.value)}
                            required
                          >
                            <option value="" disabled>Selecciona un medicamento</option>
                            {medicationCatalog.map((medication) => (
                              <option key={medication} value={medication}>{medication}</option>
                            ))}
                          </select>
                        </label>
                        {row.medicamento === "Otro" ? (
                          <label>
                            <span>Otro medicamento</span>
                            <input
                              value={row.medicamento_otro}
                              onChange={(event) => updateMedication(row.id, "medicamento_otro", event.target.value)}
                              placeholder="Nombre del medicamento"
                              required
                            />
                          </label>
                        ) : null}
                        <label>
                          <span>Dosis terapéutica</span>
                          <input
                            value={row.dosis_terapeutica}
                            onChange={(event) => updateMedication(row.id, "dosis_terapeutica", event.target.value)}
                            placeholder="Ej. 1 tableta"
                            required
                          />
                        </label>
                        <label>
                          <span>Vía de administración</span>
                          <select
                            value={row.via_administracion}
                            onChange={(event) => updateMedication(row.id, "via_administracion", event.target.value)}
                            required
                          >
                            <option value="" disabled>Selecciona la vía</option>
                            {administrationRoutes.map((route) => <option key={route} value={route}>{route}</option>)}
                          </select>
                        </label>
                        {row.via_administracion === "Otra" ? (
                          <label>
                            <span>Otra vía</span>
                            <input
                              value={row.via_administracion_otra}
                              onChange={(event) => updateMedication(row.id, "via_administracion_otra", event.target.value)}
                              placeholder="Especifica la vía"
                              required
                            />
                          </label>
                        ) : null}
                        <label>
                          <span>Frecuencia</span>
                          <select
                            value={row.frecuencia}
                            onChange={(event) => updateMedication(row.id, "frecuencia", event.target.value)}
                            required
                          >
                            <option value="" disabled>Selecciona la frecuencia</option>
                            {medicationFrequencies.map((frequency) => (
                              <option key={frequency} value={frequency}>{frequency}</option>
                            ))}
                          </select>
                        </label>
                        {row.frecuencia === "Otra" ? (
                          <label>
                            <span>Otra frecuencia</span>
                            <input
                              value={row.frecuencia_otra}
                              onChange={(event) => updateMedication(row.id, "frecuencia_otra", event.target.value)}
                              placeholder="Especifica la frecuencia"
                              required
                            />
                          </label>
                        ) : null}
                        <label>
                          <span>Cantidad total</span>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={row.cantidad_total}
                            onChange={(event) => updateMedication(row.id, "cantidad_total", event.target.value)}
                            required
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="addMedicationButton" type="button" onClick={addMedication}>
                  + Agregar otro medicamento
                </button>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </details>
  );
}

function ClinicalForm({
  pet,
  veterinarians,
  actor,
  recordedAt,
  procedureSchemaReady,
  onCancel,
  initialConsultation = null,
  readOnly = false
}: FormProps) {
  const initial: Partial<ClinicalConsultation> = initialConsultation || {};
  const [foodType, setFoodType] = useState(initial.tipo_alimento || "");
  const [stoolType, setStoolType] = useState(initial.heces || "");
  const [observation, setObservation] = useState(initial.habilitar_observacion ? "si" : "no");
  const [systemStatus, setSystemStatus] = useState<Record<string, string>>(
    () => Object.fromEntries(systems.map(([key]) => [key, initial.revision_sistemas?.[key]?.estado || "No evaluado"]))
  );
  const action = useMemo(
    () => initialConsultation?.id
      ? updateConsultation.bind(null, pet.id, initialConsultation.id)
      : createConsultation.bind(null, pet.id),
    [pet.id, initialConsultation?.id]
  );
  const defaultVeterinarianId = veterinarians.some((vet) => vet.id === actor.id)
    ? actor.id
    : veterinarians[0]?.id || "";

  return (
    <form action={readOnly ? undefined : action} className={readOnly ? "clinicalForm clinicalReadOnly" : "clinicalForm"}>
      <div className="clinicalFormHeading">
        <div>
          <p className="eyebrow">Historia clínica</p>
          <h2>{readOnly ? "Historia clínica registrada" : initialConsultation ? "Editar consulta o control" : "Nueva consulta o control"}</h2>
          <p>Fecha de registro: <strong>{formatDateTime(recordedAt)}</strong></p>
          <p>{readOnly ? "Registro de solo lectura. Pulsa Editar consulta para modificarlo." : "Completa únicamente los apartados evaluados. Los campos clínicos no diligenciados son opcionales."}</p>
        </div>
        {!readOnly ? <button className="buttonSecondary" type="button" onClick={onCancel}>Cancelar</button> : null}
      </div>
      <fieldset className="clinicalReadonlyFields" disabled={readOnly}>

      <details className="clinicalBlock" open>
        <summary>Datos de la mascota</summary>
        <div className="clinicalBlockContent patientDataBlock">
          <ReadonlyField label="Nombre" value={pet.nombre} />
          <ReadonlyField label="Número de carnet" value={pet.numero_carnet} />
          <ReadonlyField label="Especie" value={pet.especie} />
          <ReadonlyField label="Raza" value={pet.raza} />
          <ReadonlyField label="Tamaño" value={pet.tamano} />
          <ReadonlyField label="Sexo" value={pet.sexo} />
          <ReadonlyField label="Fecha de nacimiento" value={pet.fecha_nacimiento_formateada} />
          <ReadonlyField label="Estado reproductivo" value={pet.estado_reproductivo} />
          <ReadonlyField label="Color" value={pet.color} />
          <ReadonlyField label="Peso registrado" value={pet.peso_kg !== null ? `${pet.peso_kg} kg` : null} />
        </div>
      </details>

      <details className="clinicalBlock" open>
        <summary>Motivo de consulta</summary>
        <div className="clinicalBlockContent formGrid">
          <label>
            <span>Tipo de servicio</span>
            <select name="tipo_servicio" required defaultValue={initial.tipo_servicio || ""}>
              <option value="" disabled>Selecciona una opción</option>
              <option value="Consulta">Consulta</option>
              <option value="Control">Control</option>
            </select>
          </label>
          <label>
            <span>Médico veterinario</span>
            <select name="medico_veterinario_id" required defaultValue={initial.medico_veterinario_id || defaultVeterinarianId}>
              {!veterinarians.length ? <option value="">No hay veterinarios activos</option> : null}
              {initial.medico_veterinario_id && !veterinarians.some((vet) => vet.id === initial.medico_veterinario_id)
                ? <option value={initial.medico_veterinario_id}>{initial.medico_veterinario_nombre || "Médico anterior"}</option> : null}
              {veterinarians.map((vet) => (
                <option key={vet.id} value={vet.id}>{vet.nombre}</option>
              ))}
            </select>
          </label>
          <label className="fullField">
            <span>Motivo de cita</span>
            <textarea name="motivo_cita" rows={3} defaultValue={initial.motivo_cita || ""} />
          </label>
          <label className="fullField">
            <span>Anamnesis</span>
            <textarea
              name="anamnesis"
              defaultValue={initial.anamnesis || ""}
              rows={4}
              placeholder="¿En qué estado inicial se encuentra la mascota al llegar a la cita?"
            />
          </label>
          <label>
            <span>Tipo de alimento</span>
            <select name="tipo_alimento" value={foodType} onChange={(event) => setFoodType(event.target.value)}>
              <option value="">Selecciona una opción</option>
              <option value="Concentrado">Concentrado</option>
              <option value="Dieta BARF">Dieta BARF</option>
              <option value="Enlatado">Enlatado</option>
              <option value="Otro">Otro</option>
            </select>
          </label>
          {foodType === "Otro" ? (
            <label>
              <span>Otro tipo de alimento</span>
              <input name="tipo_alimento_otro" defaultValue={initial.tipo_alimento_otro || ""} placeholder="Especifica el alimento" />
            </label>
          ) : null}
          <label className="fullField">
            <span>Ración</span>
            <textarea name="racion" rows={2} defaultValue={initial.racion || ""} placeholder="¿Cómo es la ración que se le da?" />
          </label>
          <label>
            <span>Orina</span>
            <input name="orina" defaultValue={initial.orina || ""} placeholder="Estado de la orina" />
          </label>
          <label>
            <span>Heces</span>
            <select name="heces" value={stoolType} onChange={(event) => setStoolType(event.target.value)}>
              <option value="">Selecciona una opción</option>
              <option value="Normal">Normal</option>
              <option value="Blando">Blando</option>
              <option value="Pastoso">Pastoso</option>
              <option value="Líquido">Líquido</option>
              <option value="Otro">Otro</option>
            </select>
          </label>
          {stoolType === "Otro" ? (
            <label>
              <span>Otro estado de las heces</span>
              <input name="heces_otro" defaultValue={initial.heces_otro || ""} placeholder="Especifica el estado" />
            </label>
          ) : null}
        </div>
      </details>

      <details className="clinicalBlock" open>
        <summary>Examen clínico</summary>
        <div className="clinicalBlockContent">
          <div className="formGrid clinicalMeasurements">
            <label><span>F.C.</span><input name="frecuencia_cardiaca" defaultValue={initial.frecuencia_cardiaca ?? ""} type="number" min="0" placeholder="Frecuencia cardiaca" /></label>
            <label><span>F.R.</span><input name="frecuencia_respiratoria" defaultValue={initial.frecuencia_respiratoria ?? ""} type="number" min="0" placeholder="Frecuencia respiratoria" /></label>
            <label><span>Temp. (°C)</span><input name="temperatura_c" defaultValue={initial.temperatura_c ?? ""} type="number" min="20" max="50" step="0.1" placeholder="Temperatura actual" /></label>
            <label><span>TLLC</span><input name="tllc_segundos" defaultValue={initial.tllc_segundos ?? ""} type="number" min="0" step="0.1" placeholder="Tiempo de llenado capilar" /></label>
            <label><span>Pulso</span><input name="pulso" defaultValue={initial.pulso ?? ""} placeholder="Pulso" /></label>
            <label><span>Peso actual (kg)</span><input name="peso_actual_kg" type="number" min="0" step="0.01" defaultValue={initial.peso_actual_kg ?? pet.peso_kg ?? ""} placeholder="Peso actual" /></label>
            <label><span>Actitud</span><input name="actitud" defaultValue={initial.actitud ?? ""} placeholder="Decaído, adormecido, etc." /></label>
            <label><span>C/C</span><input name="condicion_corporal" defaultValue={initial.condicion_corporal ?? ""} placeholder="Condición corporal: gordo, flaco, etc." /></label>
          </div>

          <div className="systemsGrid">
            {systems.map(([key, label]) => (
              <fieldset className={systemStatus[key] === "Anormal" ? "systemAssessment isAbnormal" : "systemAssessment"} key={key}>
                <legend>{label}</legend>
                <div className="radioRow">
                  {["No evaluado", "Normal", "Anormal"].map((status) => (
                    <label key={status}>
                      <input
                        type="radio"
                        name={`sistema_${key}_estado`}
                        value={status}
                        checked={systemStatus[key] === status}
                        onChange={() => setSystemStatus((current) => ({ ...current, [key]: status }))}
                      />
                      {status}
                    </label>
                  ))}
                </div>
                {systemStatus[key] === "Anormal" ? (
                  <textarea
                    name={`sistema_${key}_detalle`}
                    rows={2}
                    defaultValue={initial.revision_sistemas?.[key]?.detalle || ""}
                    placeholder={`Describe la alteración en ${label.toLowerCase()}`}
                  />
                ) : null}
              </fieldset>
            ))}
          </div>

          <label className="stackedField">
            <span>Comentarios y observaciones</span>
            <textarea name="comentarios_observaciones" rows={4} defaultValue={initial.comentarios_observaciones || ""} />
          </label>
        </div>
      </details>

      {narrativeSections.slice(0, 5).map(([name, label]) => (
        <details className="clinicalBlock" key={name}>
          <summary>{label}</summary>
          <div className="clinicalBlockContent">
            <label className="stackedField">
              <span>Descripción</span>
              <textarea name={name} rows={5} defaultValue={narrativeValue(initial, name)} />
            </label>
          </div>
        </details>
      ))}

      {procedureSchemaReady ? (
        <ProcedureBlock pet={pet} actor={actor} recordedAt={recordedAt} initial={initial} />
      ) : (
        <div className="formAlert">
          El bloque Procedimientos estará disponible cuando se complete la actualización de la tabla clínica.
        </div>
      )}

      {narrativeSections.slice(5).map(([name, label]) => (
        <details className="clinicalBlock" key={name}>
          <summary>{label}</summary>
          <div className="clinicalBlockContent">
            <label className="stackedField">
              <span>Descripción</span>
              <textarea name={name} rows={5} defaultValue={narrativeValue(initial, name)} />
            </label>
          </div>
        </details>
      ))}

      <details className="clinicalBlock">
        <summary>Observaciones de responsabilidad</summary>
        <div className="clinicalBlockContent">
          <fieldset className="observationChoice">
            <legend>¿Habilitar observación?</legend>
            <div className="radioRow">
              <label><input type="radio" name="habilitar_observacion" value="si" checked={observation === "si"} onChange={() => setObservation("si")} />Sí</label>
              <label><input type="radio" name="habilitar_observacion" value="no" checked={observation === "no"} onChange={() => setObservation("no")} />No</label>
            </div>
          </fieldset>
          <p className="registeredDoctor">Profesional que registra la historia clínica: <strong>{initial.medico_registra_nombre || actor.nombre}</strong></p>
          {observation === "si" ? <div className="responsibilityNotice">{responsibilityText(initial.medico_registra_nombre || actor.nombre)}</div> : null}
        </div>
      </details>

      </fieldset>
      {!veterinarians.length && !readOnly ? (
        <div className="formAlert">No hay médicos veterinarios activos para esta empresa. Crea un veterinario antes de guardar la consulta.</div>
      ) : null}

      {!readOnly ? <div className="clinicalFormActions">
        <button className="buttonSecondary" type="button" onClick={onCancel}>Cancelar</button>
        <SubmitConsultationButton disabled={!veterinarians.length} />
      </div> : null}
    </form>
  );
}

function HistoryValue({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <dt>{label}</dt>
      <dd>{String(value)}</dd>
    </div>
  );
}

function ProcedureHistory({ consultation }: { consultation: ClinicalConsultation }) {
  const medicationRows = Array.isArray(consultation.formula_medicamentos)
    ? consultation.formula_medicamentos
    : [];
  const selectedTypes = Array.isArray(consultation.tipos_procedimiento)
    ? consultation.tipos_procedimiento
    : [];

  if (!consultation.procedimientos_habilitados) {
    return consultation.procedimientos
      ? <dl className="historyNarratives"><HistoryValue label="Procedimientos" value={consultation.procedimientos} /></dl>
      : null;
  }

  const serviceValue = typeof consultation.valor_total_servicio !== "number"
    ? null
    : new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0
    }).format(consultation.valor_total_servicio);

  return (
    <section className="procedureHistory">
      <h3>Procedimientos</h3>
      <dl className="historyDetailGrid">
        <HistoryValue label="Área de consulta" value={consultation.area_consulta} />
        <HistoryValue label="Tipos de procedimiento" value={selectedTypes.join(", ")} />
        <HistoryValue label="Valor total del servicio" value={serviceValue} />
        <HistoryValue label="Observaciones" value={consultation.observaciones_procedimiento} />
      </dl>

      {medicationRows.length ? (
        <div className="prescriptionHistory">
          <h4>Fórmula para tratamiento en casa</h4>
          {consultation.formula_descripcion ? <p>{consultation.formula_descripcion}</p> : null}
          <div className="medicationHistoryList">
            {medicationRows.map((row, index) => (
              <article key={`${row.medicamento}-${index}`}>
                <strong>{row.medicamento === "Otro" ? row.medicamento_otro : row.medicamento}</strong>
                <span>Dosis: {row.dosis_terapeutica}</span>
                <span>Vía: {row.via_administracion === "Otra" ? row.via_administracion_otra : row.via_administracion}</span>
                <span>Frecuencia: {row.frecuencia === "Otra" ? row.frecuencia_otra : row.frecuencia}</span>
                <span>Cantidad total: {row.cantidad_total}</span>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ConsultationEntry({ consultation, pet, veterinarians, actor, procedureSchemaReady, moduleLabel = null }: EntryProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  return (
    <details className="consultationCard" onToggle={(event) => { if (event.target === event.currentTarget) setExpanded(event.currentTarget.open); }}>
      <summary>
        <span>
          <strong>{moduleLabel || consultation.tipo_servicio}</strong>
          <small>{formatDateTime(consultation.fecha_registro)}</small>
        </span>
        <span className="historyDoctor">{consultation.medico_veterinario_nombre}</span>
      </summary>
      {expanded ? (
        <div className="consultationCardContent clinicalRecordContent">
          <div className="consultationRecordActions">
            <span>{editing ? "Editando consulta" : "Consulta guardada · Solo lectura"}</span>
            <button type="button" className="buttonSecondary" onClick={() => setEditing((open) => !open)}>
              {editing ? "Cancelar edición" : "Editar consulta"}
            </button>
          </div>
          <ClinicalForm
            key={`${consultation.id}-${editing ? "edit" : "read"}`}
            pet={pet} veterinarians={veterinarians} actor={actor}
            recordedAt={consultation.fecha_registro}
            procedureSchemaReady={procedureSchemaReady}
            initialConsultation={consultation} readOnly={!editing}
            onCancel={() => setEditing(false)}
          />
          <p className="historyRegisteredBy">Creada por <strong>{consultation.medico_registra_nombre}</strong> · Última modificación: {formatDateTime(consultation.updated_at)}</p>
        </div>
      ) : null}
    </details>
  );
}

function ConsultationHistory({ consultations, pet, veterinarians, actor, procedureSchemaReady }: CommonProps & { consultations: ClinicalConsultation[] }) {
  if (!consultations.length) {
    return <div className="emptyState clinicalEmpty"><h2>No hay registros en este período</h2><p>Crea una nueva consulta o ajusta el rango de fechas.</p></div>;
  }
  return (
    <div className="consultationHistory">
      {consultations.map((consultation) => (
        <ConsultationEntry key={consultation.id} consultation={consultation} pet={pet}
          veterinarians={veterinarians} actor={actor} procedureSchemaReady={procedureSchemaReady} />
      ))}
    </div>
  );
}

function PetHistoryOverview({ pet, latestConsultation, latestModules = [], historyEntries = [],
  eventSchemaReady, consultations, veterinarians, actor, procedureSchemaReady,
  historyOpen, historyPage, historyTotal, historyFrom, historyTo }: OverviewProps) {
  const names = [
    "Consulta y control", "Fórmula y remisión", "Procedimientos", "Vacunación",
    "Desparasitación", "Estética", "Guardería", "Seguimiento", "Consentimientos"
  ];
  const moduleOverview: Array<[string, LatestModule | null]> = names.map((name) => [
    name,
    latestModules.find((event) => event.modulo === name) || (
      !eventSchemaReady && name === "Consulta y control" && latestConsultation
        ? { modulo: name, fecha_registro: latestConsultation.fecha_registro, resumen: latestConsultation.tipo_servicio }
        : null
    )
  ]);
  const totalPages = Math.max(1, Math.ceil(historyTotal / 50));
  const historyHref = (page: number): string => {
    const q = new URLSearchParams({ historial: "1", pagina: String(page) });
    if (historyFrom) q.set("desde", historyFrom);
    if (historyTo) q.set("hasta", historyTo);
    return `/mascotas/${pet.id}?${q.toString()}`;
  };
  return (
    <section className="consultationWorkspace petHistoryOverview">
      <div className="consultationToolbar">
        <div><p className="eyebrow">Historia clínica</p><h2>Historial de la mascota</h2>
          <p>Un registro reciente por módulo de {pet.nombre}; la cronología completa se abre con «Ver más».</p>
        </div>
      </div>
      {!eventSchemaReady ? <div className="formAlert">
        Para activar el historial unificado, ejecuta la migración SQL 007 en Supabase.
      </div> : null}
      <div className="moduleOverviewGrid">
        {moduleOverview.map(([label, event]) => (
          <div className="moduleOverviewCard" key={label}>
            <strong>{label}</strong>
            {event ? (
              <div>
                <span>{formatDateTime(event.fecha_registro)}</span>
                <small>{event.resumen || "Registro asociado"}</small>
              </div>
            ) : <span className="muted">Sin registros disponibles</span>}
          </div>
        ))}
      </div>
      {!historyOpen ? (
        <div className="historyMoreAction">
          <Link className="actionLink" href={historyHref(1)}>Ver más — historial cronológico</Link>
        </div>
      ) : (
        <div className="fullClinicalTimeline" id="historial-completo">
          <div className="consultationToolbar"><h3>Historial cronológico</h3>
            <Link className="secondaryLink" href={`/mascotas/${pet.id}`}>Ver solo resumen</Link></div>
          <form method="get" action={`/mascotas/${pet.id}`} className="historyFilter">
            <input type="hidden" name="historial" value="1" />
            <label>Desde<input type="date" name="desde" defaultValue={historyFrom} /></label>
            <label>Hasta<input type="date" name="hasta" defaultValue={historyTo} /></label>
            <button type="submit">Buscar por fechas</button>
            <Link className="secondaryLink" href={`/mascotas/${pet.id}?historial=1`}>Limpiar</Link>
          </form>
          {eventSchemaReady ? (
            <>
              <p className="description">{historyTotal} eventos encontrados. Se muestran hasta 50 por página, del más reciente al más antiguo.</p>
              <div className="consultationHistory">
                {historyEntries.map((event) => event.consulta ? (
                  <ConsultationEntry key={event.id} moduleLabel={event.modulo}
                    consultation={event.consulta} pet={pet} veterinarians={veterinarians}
                    actor={actor} procedureSchemaReady={procedureSchemaReady} />
                ) : (
                  <details key={event.id} className="consultationCard">
                    <summary><strong>{event.modulo}</strong><small>{formatDateTime(event.fecha_registro)}</small></summary>
                    <div className="consultationCardContent"><p>{event.resumen || "Registro sin descripción"}</p></div>
                  </details>
                ))}
              </div>
              {!historyEntries.length ? <p>No hay eventos en el rango seleccionado.</p> : null}
              {totalPages > 1 ? (
                <nav className="historyPagination" aria-label="Paginación del historial">
                  {historyPage > 1 ? <Link href={historyHref(historyPage - 1)}>← Anterior</Link> : null}
                  <span>Página {historyPage} de {totalPages}</span>
                  {historyPage < totalPages ? <Link href={historyHref(historyPage + 1)}>Siguiente →</Link> : null}
                </nav>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}

export default function ConsultationControlPanel({
  pet,
  veterinarians,
  actor,
  consultations,
  latestConsultation,
  latestModules,
  historyEntries,
  eventSchemaReady,
  historyOpen,
  historyPage,
  historyTotal,
  historyFrom,
  historyTo,
  historyAvailable,
  procedureSchemaReady,
  recordedAt,
  initialModule,
  initialView,
  success,
  error
}: PanelProps) {
  const [selectedModule, setSelectedModule] = useState(initialModule);
  const [view, setView] = useState(initialView);

  function selectModule(key: string): void {
    if (key === "historia" || key === "consulta-control") {
      setSelectedModule(key);
      if (key === "consulta-control") setView("history");
    }
  }

  return (
    <>
      <nav className="clinicalModules" aria-label="Módulos clínicos">
        {modules.map(([key, label]) => {
          const enabled = key === "historia" || key === "consulta-control";
          return (
            <button
              className={selectedModule === key ? "active" : ""}
              type="button"
              key={key}
              disabled={!enabled}
              title={!enabled ? "Este módulo se configurará después" : undefined}
              onClick={() => selectModule(key)}
            >
              {label}
            </button>
          );
        })}
      </nav>

      {selectedModule === "historia" ? (
        <PetHistoryOverview pet={pet} latestConsultation={latestConsultation}
          latestModules={latestModules} historyEntries={historyEntries} eventSchemaReady={eventSchemaReady}
          historyOpen={historyOpen} historyPage={historyPage} historyTotal={historyTotal}
          historyFrom={historyFrom} historyTo={historyTo} consultations={consultations}
          veterinarians={veterinarians} actor={actor} procedureSchemaReady={procedureSchemaReady} />
      ) : null}

      {selectedModule === "consulta-control" ? (
        <section className="consultationWorkspace">
          {(success === "consulta_creada" || success === "consulta_actualizada") && view === "history" ? (
            <div className="successAlert">{success === "consulta_actualizada" ? "La consulta se actualizó correctamente." : "La consulta clínica se guardó correctamente."}</div>
          ) : null}
          {error ? (
            <div className="formAlert">
              {error === "medico"
                ? "El médico seleccionado no está disponible para esta empresa."
                : error === "datos_requeridos"
                  ? "Selecciona el tipo de servicio y el médico veterinario."
                  : error === "procedimientos"
                    ? "Selecciona el área de consulta del bloque Procedimientos."
                    : error === "formula"
                      ? "Completa todos los datos de los medicamentos de la fórmula."
                      : error === "actualizar_bd"
                        ? "Completa la actualización de la tabla clínica antes de guardar procedimientos."
                  : "No fue posible guardar la consulta. Verifica que la tabla clínica esté activa en Supabase."}
            </div>
          ) : null}

          {view === "new" ? (
            <ClinicalForm
              pet={pet}
              veterinarians={veterinarians}
              actor={actor}
              recordedAt={recordedAt}
              procedureSchemaReady={procedureSchemaReady}
              onCancel={() => setView("history")}
            />
          ) : (
            <>
              <div className="consultationToolbar">
                <div>
                  <p className="eyebrow">Historia clínica</p>
                  <h2>Consultas y controles</h2>
                  <p>Registros asociados a {pet.nombre}.</p>
                </div>
                <div className="consultationActions">
                  <button type="button" onClick={() => setView("new")}>Nueva consulta</button>
                  <button className="buttonSecondary" type="button" disabled title="La agenda se configurará en el siguiente paso">Agendar cita</button>
                </div>
              </div>
              {!historyAvailable ? (
                <div className="formAlert">La tabla de consultas todavía no está activa en Supabase.</div>
              ) : (
                <><ConsultationHistory consultations={consultations} pet={pet}
                  veterinarians={veterinarians} actor={actor} procedureSchemaReady={procedureSchemaReady} />
                  <Link className="secondaryLink" href={`/mascotas/${pet.id}?historial=1`}>Ver más registros</Link></>
              )}
            </>
          )}
        </section>
      ) : null}
    </>
  );
}
