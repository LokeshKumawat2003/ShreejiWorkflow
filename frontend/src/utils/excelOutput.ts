import type { CellValue, Workbook } from 'exceljs';

export type ExcelColumn<T> = {
  header: string;
  width: number;
  value: (row: T) => CellValue;
};

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function createWorkbook() {
  const { default: ExcelJS } = await import('exceljs');
  return new ExcelJS.Workbook();
}

/** Adds a sheet with a bold header row followed by one row per item. */
export function addTableSheet<T>(workbook: Workbook, name: string, columns: ExcelColumn<T>[], rows: T[]) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns.map(({ header, width }) => ({ header, width }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(columns.map((column) => column.value(row))));
  return sheet;
}

/** Adds a sheet from a plain grid of values; empty arrays become blank rows. */
export function addRowsSheet(workbook: Workbook, name: string, rows: CellValue[][], widths: number[] = []) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = widths.map((width) => ({ width }));
  rows.forEach((row) => sheet.addRow(row));
  return sheet;
}

export async function downloadWorkbook(workbook: Workbook, fileName: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: XLSX_MIME }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
