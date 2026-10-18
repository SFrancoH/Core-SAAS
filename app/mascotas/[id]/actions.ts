"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  administrationRoutes,
  medicationFrequencies,
  medications,
  procedureTypes
} from "@/lib/verticals/pets/clinical-catalogs";
import { requireOperationalProfile } from "@/lib/verticals/pets/operational";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const serviceTypes = new Set(["Consulta", "Control"]);
const foodTypes = new Set(["Concentrado", "Dieta BARF", "Enlatado", "Otro"]);
const stoolTypes = new Set(["Normal", "Blando", "Pastoso", "Líquido", "Otro"]);
const procedureAreas = new Set(["Medicación", "Hospitalización"]);
const allowedProcedureTypes = new Set(procedureTypes);
const allowedMedications = new Set(medications);
const allowedAdministrationRoutes = new Set(administrationRoutes);
const allowedMedicationFrequencies = new Set(medicationFrequencies);
const systemKeys = [
  "organos_sentidos",
  "ganglios_linfaticos",
  "sistema_respiratorio",
  "sistema_cardiovascular",
  "sistema_digestivo",
  "sistema_musculo_esqueletico",
  "piel_pelaje",
  "sistema_neurologico",
  "sistema_urinario",
  "sistema_reproductivo"
];

function text(formData: FormData, name: string, maxLength = 10000): string | null {
  const value = String(formData.get(name) || "").trim();
  return value ? value.slice(0, maxLength) : null;
}

function number(formData: FormData, name: string, integer = false): number | null {
  const value = String(formData.get(name) || "").trim().replace(",", ".");
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return integer ? Math.trunc(parsed) : parsed;
}

function safeText(value: unknown, maxLength = 1000): string | null {
  const normalized = String(value || "").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

type MedicationRow = {
  medicamento: string; medicamento_otro: string | null;
  dosis_terapeutica: string; via_administracion: string;
  via_administracion_otra: string | null; frecuencia: string;
  frecuencia_otra: string | null; cantidad_total: number;
};
type ClinicalSystem = { estado: "Normal" | "Anormal"; detalle: string | null };
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function parseMedicationRows(value: unknown): MedicationRow[] | null {
  try {
    const parsed: unknown = JSON.parse(String(value || "[]"));
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 20) return null;

    const rows = parsed.map((raw: unknown): MedicationRow | null => {
      if (!isRecord(raw)) return null;
      const item = raw;
      const medicamento = safeText(item?.medicamento, 200);
      const medicamentoOtro = safeText(item?.medicamento_otro, 200);
      const dosis = safeText(item?.dosis_terapeutica, 500);
      const via = safeText(item?.via_administracion, 50);
      const viaOtra = safeText(item?.via_administracion_otra, 200);
      const frecuencia = safeText(item?.frecuencia, 50);
      const frecuenciaOtra = safeText(item?.frecuencia_otra, 200);
      const cantidad = Number(String(item?.cantidad_total || "").replace(",", "."));

      if (
        !medicamento || !allowedMedications.has(medicamento)
        || (medicamento === "Otro" && !medicamentoOtro)
        || !dosis
        || !via || !allowedAdministrationRoutes.has(via)
        || (via === "Otra" && !viaOtra)
        || !frecuencia || !allowedMedicationFrequencies.has(frecuencia)
        || (frecuencia === "Otra" && !frecuenciaOtra)
        || !Number.isFinite(cantidad)
        || cantidad <= 0
      ) return null;

      return {
        medicamento,
        medicamento_otro: medicamento === "Otro" ? medicamentoOtro : null,
        dosis_terapeutica: dosis,
        via_administracion: via,
        via_administracion_otra: via === "Otra" ? viaOtra : null,
        frecuencia,
        frecuencia_otra: frecuencia === "Otra" ? frecuenciaOtra : null,
        cantidad_total: cantidad
      };
    });

    return rows.some((row) => row === null) ? null : rows as MedicationRow[];
  } catch {
    return null;
  }
}

export async function createConsultation(petId: string, formData: FormData) {
  return saveConsultation(petId, null, formData);
}

export async function updateConsultation(petId: string, consultationId: string, formData: FormData) {
  if (!uuidPattern.test(consultationId || "")) redirect("/mascotas");
  return saveConsultation(petId, consultationId, formData);
}

async function saveConsultation(petId: string, consultationId: string | null, formData: FormData) {
  const actor = await requireOperationalProfile();
  if (!uuidPattern.test(petId)) redirect("/mascotas");

  try {
    const admin = getSupabaseAdmin();
    let petQuery = admin.from("mascotas").select("id, empresa_id").eq("id", petId);
    if (actor.rol !== "super_admin") petQuery = petQuery.eq("empresa_id", actor.empresa_id);
    const { data: pet, error: petError } = await petQuery.maybeSingle();
    if (petError || !pet) redirect("/mascotas");
    if (consultationId) {
      const { data: existing, error: existingError } = await admin.from("consultas_controles")
        .select("id").eq("id", consultationId).eq("empresa_id", pet.empresa_id)
        .eq("mascota_id", pet.id).maybeSingle();
      if (existingError || !existing) redirect("/mascotas");
    }

    const serviceType = text(formData, "tipo_servicio", 20);
    const veterinarianId = text(formData, "medico_veterinario_id", 36);
    if (!serviceTypes.has(serviceType || "") || !uuidPattern.test(veterinarianId || "")) {
      redirect(`/mascotas/${petId}?modulo=consulta-control&vista=nueva&error=datos_requeridos`);
    }

    const { data: veterinarian } = await admin
      .from("usuarios")
      .select("id, empresa_id, nombre, rol, activo")
      .eq("id", veterinarianId)
      .eq("activo", true)
      .maybeSingle();
    const validCompanyVeterinarian = veterinarian?.rol === "veterinario"
      && veterinarian.empresa_id === pet.empresa_id;
    const validSuperAdmin = veterinarian?.id === actor.id && actor.rol === "super_admin";
    if (!veterinarian || (!validCompanyVeterinarian && !validSuperAdmin)) {
      redirect(`/mascotas/${petId}?modulo=consulta-control&vista=nueva&error=medico`);
    }

    const foodType = text(formData, "tipo_alimento", 30);
    const stoolType = text(formData, "heces", 20);
    const proceduresEnabled = formData.get("procedimientos_habilitados") === "si";
    const procedureArea = text(formData, "area_consulta", 50);
    const selectedProcedureTypes = formData
      .getAll("tipos_procedimiento")
      .map((value) => String(value))
      .filter((value) => allowedProcedureTypes.has(value));
    if (proceduresEnabled && !procedureAreas.has(procedureArea || "")) {
      redirect(`/mascotas/${petId}?modulo=consulta-control&vista=nueva&error=procedimientos`);
    }

    const homeTreatmentSelected = selectedProcedureTypes.includes("Tratamiento farmacológico en casa");
    const medicationRows = homeTreatmentSelected
      ? parseMedicationRows(formData.get("formula_medicamentos"))
      : [];
    if (homeTreatmentSelected && !medicationRows) {
      redirect(`/mascotas/${petId}?modulo=consulta-control&vista=nueva&error=formula`);
    }

    const systems: Record<string, ClinicalSystem> = {};
    systemKeys.forEach((key) => {
      const status = text(formData, `sistema_${key}_estado`, 20);
      // No registrar como normal un sistema que el veterinario no evaluó.
      if (status !== "Normal" && status !== "Anormal") return;
      systems[key] = {
        estado: status,
        detalle: status === "Anormal" ? text(formData, `sistema_${key}_detalle`, 2000) : null
      };
    });

    const record = {
      empresa_id: pet.empresa_id,
      mascota_id: pet.id,
      tipo_servicio: serviceType,
      motivo_cita: text(formData, "motivo_cita"),
      medico_veterinario_id: veterinarian.id,
      medico_veterinario_nombre: veterinarian.nombre,
      anamnesis: text(formData, "anamnesis"),
      tipo_alimento: foodTypes.has(foodType || "") ? foodType : null,
      tipo_alimento_otro: foodType === "Otro" ? text(formData, "tipo_alimento_otro", 500) : null,
      racion: text(formData, "racion", 2000),
      orina: text(formData, "orina", 2000),
      heces: stoolTypes.has(stoolType || "") ? stoolType : null,
      heces_otro: stoolType === "Otro" ? text(formData, "heces_otro", 500) : null,
      frecuencia_cardiaca: number(formData, "frecuencia_cardiaca", true),
      frecuencia_respiratoria: number(formData, "frecuencia_respiratoria", true),
      temperatura_c: number(formData, "temperatura_c"),
      tllc_segundos: number(formData, "tllc_segundos"),
      pulso: text(formData, "pulso", 500),
      peso_actual_kg: number(formData, "peso_actual_kg"),
      actitud: text(formData, "actitud", 1000),
      condicion_corporal: text(formData, "condicion_corporal", 1000),
      revision_sistemas: systems,
      comentarios_observaciones: text(formData, "comentarios_observaciones"),
      lista_problemas: text(formData, "lista_problemas"),
      diagnostico_diferencial: text(formData, "diagnostico_diferencial"),
      diagnostico_presuntivo: text(formData, "diagnostico_presuntivo"),
      examenes_laboratorio: text(formData, "examenes_laboratorio"),
      imagenes_diagnosticas: text(formData, "imagenes_diagnosticas"),
      procedimientos_habilitados: proceduresEnabled,
      area_consulta: proceduresEnabled ? procedureArea : null,
      tipos_procedimiento: proceduresEnabled ? selectedProcedureTypes : [],
      valor_total_servicio: proceduresEnabled ? number(formData, "valor_total_servicio") : null,
      observaciones_procedimiento: proceduresEnabled ? text(formData, "observaciones_procedimiento") : null,
      formula_descripcion: homeTreatmentSelected ? text(formData, "formula_descripcion") : null,
      formula_medicamentos: medicationRows || [],
      diagnostico_definitivo: text(formData, "diagnostico_definitivo"),
      tratamiento: text(formData, "tratamiento"),
      pronostico: text(formData, "pronostico"),
      notas: text(formData, "notas"),
      habilitar_observacion: formData.get("habilitar_observacion") === "si",
      registrada_por: actor.id,
      medico_registra_nombre: actor.nombre
    };

    // Al editar, nunca sobrescribir la autoría original.
    const row = consultationId
      ? (() => {
        const { registrada_por: _originalAuthor, medico_registra_nombre: _originalVet, ...editable } = record;
        return { ...editable, ultima_edicion_por: actor.id };
      })()
      : record;
    let { error } = consultationId
      ? await admin.from("consultas_controles").update(row).eq("id", consultationId)
          .eq("empresa_id", pet.empresa_id).eq("mascota_id", pet.id)
      : await admin.from("consultas_controles").insert(row);
    const missingProcedureSchema = error && (
      error.code === "PGRST204"
      || /procedimientos_habilitados|formula_medicamentos|area_consulta/i.test(error.message || "")
    );

    if (missingProcedureSchema && !consultationId) {
      if (proceduresEnabled) {
        redirect(`/mascotas/${petId}?modulo=consulta-control&vista=nueva&error=actualizar_bd`);
      }

      const unsupportedFields = new Set([
        "procedimientos_habilitados", "area_consulta", "tipos_procedimiento",
        "valor_total_servicio", "observaciones_procedimiento", "formula_descripcion", "formula_medicamentos"
      ]);
      const legacyRow = Object.fromEntries(Object.entries(record).filter(([key]) => !unsupportedFields.has(key)));
      ({ error } = await admin.from("consultas_controles").insert(legacyRow));
    }

    if (error) throw error;

    revalidatePath(`/mascotas/${petId}`);
    redirect(`/mascotas/${petId}?modulo=consulta-control&ok=${consultationId ? "consulta_actualizada" : "consulta_creada"}`);
  } catch (error: unknown) {
    const info = isRecord(error) ? error : {};
    if (typeof info.digest === "string" && info.digest.startsWith("NEXT_REDIRECT")) throw error;
    console.error("No fue posible crear la consulta clínica", {
      code: typeof info.code === "string" ? info.code : undefined,
      message: typeof info.message === "string" ? info.message : undefined
    });
    redirect(`/mascotas/${petId}?modulo=consulta-control&error=guardar`);
  }
}
