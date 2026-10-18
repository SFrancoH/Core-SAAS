// @ts-nocheck — compatibilidad PETS pendiente de tipado completo.
import "server-only";

import ExcelJS from "exceljs";

export async function createExcelFile({ sheetName, columns, rows }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PETS";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  sheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width || 18,
    style: column.numFmt ? { numFmt: column.numFmt } : undefined
  }));
  sheet.addRows(rows);
  sheet.autoFilter = { from: "A1", to: `${sheet.getColumn(columns.length).letter}1` };
  sheet.getRow(1).height = 24;
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF147D4A" } };
  sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) row.alignment = { vertical: "middle" };
  });

  return workbook.xlsx.writeBuffer();
}

export function excelDate(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
