import ExcelJS from "exceljs";

/**
 * Excel read/write for the "registry" lists:
 *  - appendRows(): add issued policies to a running register
 *  - readRows():   fetch/scan data from the big lookup lists
 *
 * ExcelJS preserves existing formatting/formulas when you load-then-save,
 * which matters for the company's existing registry workbooks.
 */

export type Row = Record<string, string | number | boolean | Date | null>;

/** Read every row of a sheet as objects keyed by the header row. */
export async function readRows(fileBytes: Buffer, sheetName?: string): Promise<Row[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(fileBytes as unknown as ArrayBuffer);
  const ws = sheetName ? wb.getWorksheet(sheetName) : wb.worksheets[0];
  if (!ws) return [];

  const headers: string[] = [];
  ws.getRow(1).eachCell((cell, col) => {
    headers[col] = String(cell.value ?? `col${col}`);
  });

  const rows: Row[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Row = {};
    row.eachCell((cell, col) => {
      obj[headers[col]] = cell.value as Row[string];
    });
    rows.push(obj);
  });
  return rows;
}

/** Append rows to a sheet and return the updated workbook bytes. */
export async function appendRows(
  fileBytes: Buffer,
  newRows: Row[],
  sheetName?: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(fileBytes as unknown as ArrayBuffer);
  const ws = (sheetName ? wb.getWorksheet(sheetName) : wb.worksheets[0]) ?? wb.addWorksheet(sheetName ?? "Sheet1");

  const headers: string[] = [];
  ws.getRow(1).eachCell((cell, col) => {
    headers[col] = String(cell.value ?? "");
  });

  for (const r of newRows) {
    const values: (Row[string])[] = [];
    headers.forEach((h, col) => {
      if (col > 0) values[col] = r[h] ?? null;
    });
    ws.addRow(values);
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
