import "server-only";

import ExcelJS from "exceljs";

const maxFileSize = 5 * 1024 * 1024;
const maxRows = 5000;

function repairMojibake(value: unknown): string {
  const text = String(value || "");
  if (!/[ÃÂ]/.test(text)) return text;
  const repaired = Buffer.from(text, "latin1").toString("utf8");
  return repaired.includes("�") ? text : repaired;
}

export function normalizeHeader(value: unknown): string {
  return repairMojibake(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function compactHeader(value: unknown): string {
  return normalizeHeader(value).replace(/_/g, "");
}

function cellValue(cell: ExcelJS.Cell): unknown {
  const value = cell.value;
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    if ("result" in value) return value.result;
    if ("text" in value) return value.text;
    if ("richText" in value && Array.isArray(value.richText))
      return value.richText.map((item: { text: string }) => item.text).join("");
  }
  return value;
}

function detectDelimiter(text: string): string {
  const candidates = [",", ";", "\t"];
  const counts = new Map(candidates.map((candidate) => [candidate, 0]));
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') index += 1;
      else quoted = !quoted;
      continue;
    }
    if (!quoted && (character === "\n" || character === "\r")) break;
    if (!quoted && counts.has(character)) counts.set(character, (counts.get(character) ?? 0) + 1);
  }

  return candidates.reduce((best, candidate) => (counts.get(candidate) ?? 0) > (counts.get(best) ?? 0) ? candidate : best, ",");
}

function parseCsv(text: string): string[][] {
  const delimiter = detectDelimiter(text);
  const table: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && character === delimiter) {
      row.push(value);
      value = "";
    } else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => String(cell).trim() !== "")) table.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (value || row.length) {
    row.push(value);
    if (row.some((cell) => String(cell).trim() !== "")) table.push(row);
  }
  return table;
}

function recordsFromTable(table: readonly (readonly unknown[])[]): Record<string, unknown>[] {
  if (!table.length) throw new Error("EMPTY_WORKBOOK");
  const headers = table[0].map(normalizeHeader);
  const rows: Record<string, unknown>[] = [];

  for (const sourceRow of table.slice(1, maxRows + 1)) {
    const record: Record<string, unknown> = {};
    let hasValue = false;
    headers.forEach((header, index) => {
      if (!header) return;
      const value = sourceRow[index] ?? null;
      if (value !== null && String(value).trim() !== "") hasValue = true;
      record[header] = value;
    });
    if (hasValue) rows.push(record);
  }
  return rows;
}

async function readXlsx(buffer: Buffer): Promise<Record<string, unknown>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as Parameters<typeof workbook.xlsx.load>[0]);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("EMPTY_WORKBOOK");

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    headers[columnNumber] = normalizeHeader(cellValue(cell));
  });

  const rows: Record<string, unknown>[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || rows.length >= maxRows) return;
    const record: Record<string, unknown> = {};
    let hasValue = false;
    headers.forEach((header, columnNumber) => {
      if (!header) return;
      const value = cellValue(row.getCell(columnNumber));
      if (value !== null && String(value).trim() !== "") hasValue = true;
      record[header] = value;
    });
    if (hasValue) rows.push(record);
  });
  return rows;
}

export async function readFirstWorksheet(file: File): Promise<Record<string, unknown>[]> {
  if (!file || typeof file.arrayBuffer !== "function" || file.size === 0 || file.size > maxFileSize) {
    throw new Error("INVALID_FILE");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isCsv = String(file.name || "").toLowerCase().endsWith(".csv") || String(file.type || "").includes("csv");
  if (isCsv) {
    const text = new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "");
    return recordsFromTable(parseCsv(text));
  }
  return readXlsx(buffer);
}

export function pick(record: Record<string, unknown>, names: readonly string[]): unknown {
  const entries = Object.entries(record);
  for (const name of names) {
    const key = normalizeHeader(name);
    const compactKey = compactHeader(name);
    const exact = record[key];
    if (exact !== undefined && exact !== null && String(exact).trim() !== "") return exact;
    const loose = entries.find(([recordKey, value]) =>
      compactHeader(recordKey) === compactKey && value !== undefined && value !== null && String(value).trim() !== ""
    );
    if (loose) return loose[1];
  }
  return null;
}

export function textValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

export function numberValue(value: unknown, integer = false): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed)) return null;
  return integer ? Math.trunc(parsed) : parsed;
}

export function weightKgValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim().toLowerCase().replace(",", ".").replace(/\s+/g, "");
  const match = /^(\d+(?:\.\d+)?)(kg|kgs|kilogramo|kilogramos|g|gr|gramo|gramos)?$/.exec(normalized);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  return ["g", "gr", "gramo", "gramos"].includes(match[2]) ? amount / 1000 : amount;
}

export function booleanValue(value: unknown): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  return ["si", "sí", "yes", "true", "1", "activo"].includes(normalized);
}

function validDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}

export function dateValue(value: unknown, slashOrder: "DMY" | "MDY" = "DMY"): string | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const local = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(text);
  if (!local) return null;
  const first = Number(local[1]);
  const second = Number(local[2]);
  const year = Number(local[3]);
  const monthFirst = first <= 12 && (second > 12 || slashOrder === "MDY");
  return monthFirst ? validDate(year, first, second) : validDate(year, second, first);
}

type PaginatedResult<T> = { data: T[] | null; error: unknown };
export async function fetchAll<T>(
  queryFactory: (from: number, to: number) => PromiseLike<PaginatedResult<T>>,
  pageSize = 1000
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await queryFactory(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

type BulkWriteClient = {
  from(table: string): {
    insert(rows: Record<string, unknown>[]): PromiseLike<{ error: unknown }>;
    upsert(rows: Record<string, unknown>[], options?: { onConflict?: string; ignoreDuplicates?: boolean }): PromiseLike<{ error: unknown }>;
  };
};
export async function insertInChunks(
  table: string, rows: Record<string, unknown>[], admin: BulkWriteClient, chunkSize = 250
): Promise<void> {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const { error } = await admin.from(table).insert(rows.slice(index, index + chunkSize));
    if (error) throw error;
  }
}

export async function upsertInChunks(
  table: string, rows: Record<string, unknown>[], admin: BulkWriteClient,
  options?: { onConflict?: string; ignoreDuplicates?: boolean }, chunkSize = 250
): Promise<void> {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const { error } = await admin.from(table).upsert(rows.slice(index, index + chunkSize), options);
    if (error) throw error;
  }
}
