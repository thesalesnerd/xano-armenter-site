import Papa from 'papaparse';
import readXlsxFile from 'read-excel-file/universal';

export type Sheet = {
  /** File name, plus " › sheet" for workbooks with several sheets. */
  name: string;
  headers: string[];
  rows: Record<string, string>[];
};

/** Converts a spreadsheet cell to the text we import. Dates become YYYY-MM-DD. */
export function cellText(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v).trim();
}

/** Turns a grid (first non-empty row = headers) into objects. Duplicate headers get " (2)", " (3)". */
export function gridToSheet(name: string, grid: unknown[][]): Sheet | null {
  const start = grid.findIndex((r) => r.some((c) => cellText(c) !== ''));
  if (start < 0) return null;
  const seen = new Map<string, number>();
  const headers = grid[start].map((c, i) => {
    const base = cellText(c) || `Column ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
  const rows: Record<string, string>[] = [];
  for (const r of grid.slice(start + 1)) {
    if (!r.some((c) => cellText(c) !== '')) continue;
    rows.push(Object.fromEntries(headers.map((h, i) => [h, cellText(r[i])])));
  }
  return { name, headers, rows };
}

export function parseCsvText(name: string, text: string): Sheet | null {
  const res = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: 'greedy' });
  return gridToSheet(name, res.data);
}

/** Reads CSV, TSV and XLSX files into sheets. Workbooks yield one sheet per tab. */
export async function readSpreadsheet(file: { name: string; arrayBuffer(): Promise<ArrayBuffer>; text(): Promise<string> }): Promise<Sheet[]> {
  if (/\.xlsx$/i.test(file.name)) {
    const tabs = await readXlsxFile(await file.arrayBuffer());
    return tabs
      .map((t) => gridToSheet(tabs.length > 1 ? `${file.name} › ${t.sheet}` : file.name, t.data as unknown[][]))
      .filter((s): s is Sheet => !!s && s.rows.length > 0);
  }
  if (/\.xls$/i.test(file.name)) {
    throw new Error(`${file.name}: old .xls files can't be read. Open it and save as .xlsx or .csv.`);
  }
  const s = parseCsvText(file.name, await file.text());
  return s && s.rows.length ? [s] : [];
}
