/**
 * Lector puro compartido para contratos JSON GHL. Soporta root/customData/
 * custom_data/custom_fields/data/contact/fields y claves literales prefijadas.
 * Los campos de identidad que se contradigan se reportan; NO se autorizan.
 */
const SOURCE_KEYS = ["data", "contact", "customData", "custom_data", "custom_fields", "fields"];
const PREFIXES = ["customData.", "custom_data.", "custom_fields.", "data.", "contact.", "fields."];

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function scalar(value) {
  if (value === null || value === undefined || typeof value === "object") return null;
  const text = String(value).trim();
  return text ? text : null;
}

function variants(body, keys) {
  const root = record(body);
  if (!root) return [];
  const sources = [root, ...SOURCE_KEYS.map((key) => record(root[key])).filter(Boolean)];
  const values = [];
  for (const source of sources) {
    for (const key of keys) {
      const value = Object.hasOwn(source, key) ? scalar(source[key]) : null;
      if (value !== null) values.push(value);
      if (source === root) {
        for (const prefix of PREFIXES) {
          const literal = scalar(root[prefix + key]);
          if (literal !== null) values.push(literal);
        }
      }
    }
  }
  return values;
}

export function pickGhlField(body, ...keys) {
  return variants(body, keys)[0] ?? "";
}

export function normalizeGhlFields(body, definitions, { strict = [] } = {}) {
  const values = {};
  const conflicts = [];
  for (const [field, aliases] of Object.entries(definitions)) {
    const found = variants(body, [field, ...aliases]);
    values[field] = found[0] ?? "";
    if (strict.includes(field) && new Set(found).size > 1) conflicts.push(field);
  }
  return { values, conflicts };
}
