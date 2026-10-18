/**
 * Parser tipado común para JSON GHL.
 * Lee raíz, customData/custom_data/custom_fields, aliases y prefijos literales.
 * No autentica ni escribe en la base de datos.
 */
type JsonRecord = Record<string, unknown>;

const SOURCE_KEYS = ["data", "contact", "customData", "custom_data", "custom_fields", "fields"] as const;
const PREFIXES = ["customData.", "custom_data.", "custom_fields.", "data.", "contact.", "fields."] as const;

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function scalar(value: unknown): string | null {
  if (value === null || value === undefined || typeof value === "object") return null;
  const text = String(value).trim();
  return text ? text : null;
}

function variants(body: unknown, keys: readonly string[]): string[] {
  const root = record(body);
  if (!root) return [];
  const sources: JsonRecord[] = [
    root,
    ...SOURCE_KEYS.map(key => record(root[key])).filter((item): item is JsonRecord => item !== null)
  ];
  const values: string[] = [];
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

export function pickGhlField(body: unknown, ...keys: string[]): string {
  return variants(body, keys)[0] ?? "";
}

export interface GhlNormalizeResult {
  values: Record<string, string>;
  conflicts: string[];
}

export function normalizeGhlFields(
  body: unknown,
  definitions: Record<string, readonly string[]>,
  { strict = [] }: { strict?: readonly string[] } = {}
): GhlNormalizeResult {
  const values: Record<string, string> = {};
  const conflicts: string[] = [];
  for (const [field, aliases] of Object.entries(definitions)) {
    const found = variants(body, [field, ...aliases]);
    values[field] = found[0] ?? "";
    if (strict.includes(field) && new Set(found).size > 1) conflicts.push(field);
  }
  return { values, conflicts };
}
