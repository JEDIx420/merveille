/**
 * Open-source CSV & XLSX parser and safe CSV exporter (Stage N02, NAC-007).
 * Uses `fflate` (MIT) for XLSX ZIP decompression.
 * Preserves phone strings, resolves Excel 1900/1904 dates, flags formula cells,
 * detects legacy .xls binary headers, and neutralizes CSV formula injection.
 */

import { unzipSync, strFromU8 } from "fflate";

export interface ParsedCell {
  raw: string;
  isFormula: boolean;
  hasCachedValue: boolean;
  isAmbiguousDate?: boolean;
}

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: Array<{ rowNumber: number; cells: Record<string, ParsedCell> }>;
}

export interface WorkbookParseResult {
  fileKind: "CSV" | "XLSX";
  dateSystem: "1900" | "1904";
  sheets: ParsedSheet[];
}

const EXCEL_XLS_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export function isLegacyXlsBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  return EXCEL_XLS_MAGIC.every((b, idx) => bytes[idx] === b);
}

/**
 * Convert an Excel serial date number to YYYY-MM-DD in Asia/Kolkata.
 */
export function excelSerialToIsoDate(serial: number, dateSystem: "1900" | "1904" = "1900"): string | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  // 1900 system has the famous Lotus 1-2-3 leap year bug (serial 60 = 1900-02-29)
  const epochDays = dateSystem === "1904" ? 24107 : serial >= 60 ? 25569 : 25568;
  const utcMs = Math.round((serial - epochDays) * 86400 * 1000);
  const d = new Date(utcMs);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Neutralize CSV formula injection (=, +, -, @, tab, CR) on export while preserving value in DB.
 */
export function neutralizeCsvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function parseCsvText(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  const text = csvText.replace(/^\uFEFF/, ""); // strip UTF-8 BOM
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        currentRow.push(currentField);
        currentField = "";
      } else if (ch === "\r" && text[i + 1] === "\n") {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
        i++;
      } else if (ch === "\n" || ch === "\r") {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else {
        currentField += ch;
      }
    }
  }
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

export function parseSpreadsheetBytes(
  fileName: string,
  bytes: Uint8Array,
  maxRows = 2000
): WorkbookParseResult {
  if (isLegacyXlsBytes(bytes)) {
    throw new Error(
      "Legacy binary .xls format detected. Please open the file in Excel/LibreOffice and save as .xlsx or .csv before importing."
    );
  }

  const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!isZip && /\.(csv|txt)$/i.test(fileName)) {
    const text = new TextDecoder("utf-8").decode(bytes);
    const matrix = parseCsvText(text);
    if (matrix.length === 0) {
      return { fileKind: "CSV", dateSystem: "1900", sheets: [] };
    }
    const headers = matrix[0].map((h, idx) => h.trim() || `Column_${idx + 1}`);
    const dataRows = matrix.slice(1, 1 + maxRows).map((r, i) => {
      const cells: Record<string, ParsedCell> = {};
      headers.forEach((h, colIdx) => {
        const val = (r[colIdx] ?? "").trim();
        cells[h] = {
          raw: val,
          isFormula: /^[=]/.test(val),
          hasCachedValue: !/^[=]/.test(val),
        };
      });
      return { rowNumber: i + 2, cells };
    });
    return {
      fileKind: "CSV",
      dateSystem: "1900",
      sheets: [{ name: "CSV", headers, rows: dataRows }],
    };
  }

  if (!isZip) {
    throw new Error("Unsupported or malformed spreadsheet file. Upload a valid .xlsx or .csv file.");
  }

  const files = unzipSync(bytes);
  const workbookXml = files["xl/workbook.xml"] ? strFromU8(files["xl/workbook.xml"]) : "";
  const dateSystem: "1900" | "1904" = /date1904="1"|date1904="true"/i.test(workbookXml) ? "1904" : "1900";

  // Shared strings
  const sharedStrings: string[] = [];
  if (files["xl/sharedStrings.xml"]) {
    const sst = strFromU8(files["xl/sharedStrings.xml"]);
    const siMatches = sst.match(/<si\b[^>]*>[\s\S]*?<\/si>/g) || [];
    for (const si of siMatches) {
      const tMatches = si.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || [];
      const text = tMatches.map((t) => decodeXmlEntities(t.replace(/<[^>]+>/g, ""))).join("");
      sharedStrings.push(text);
    }
  }

  // Sheet names from workbook.xml
  const sheetNames: string[] = [];
  const sheetTagRegex = /<sheet\b[^>]*name="([^"]+)"[^>]*\/?>/g;
  let sm: RegExpExecArray | null;
  while ((sm = sheetTagRegex.exec(workbookXml)) !== null) {
    sheetNames.push(decodeXmlEntities(sm[1]));
  }

  const sheetPaths = Object.keys(files)
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => {
      const na = Number(a.match(/sheet(\d+)/)?.[1] || 0);
      const nb = Number(b.match(/sheet(\d+)/)?.[1] || 0);
      return na - nb;
    });

  const sheets: ParsedSheet[] = [];
  sheetPaths.forEach((sp, idx) => {
    const xml = strFromU8(files[sp]);
    const matrix = parseWorksheetXml(xml, sharedStrings);
    if (matrix.length === 0) return;

    // Pick first non-empty row as header
    const headerIdx = matrix.findIndex((r) => r.some((c) => c.raw.trim().length > 0));
    if (headerIdx === -1) return;

    const headers = matrix[headerIdx].map((c, colIdx) => c.raw.trim() || `Column_${colIdx + 1}`);
    const dataRows = matrix.slice(headerIdx + 1, headerIdx + 1 + maxRows).map((r, rOffset) => {
      const cells: Record<string, ParsedCell> = {};
      headers.forEach((h, colIdx) => {
        cells[h] = r[colIdx] ?? { raw: "", isFormula: false, hasCachedValue: true };
      });
      return { rowNumber: headerIdx + rOffset + 2, cells };
    });

    sheets.push({
      name: sheetNames[idx] || `Sheet${idx + 1}`,
      headers,
      rows: dataRows,
    });
  });

  return { fileKind: "XLSX", dateSystem, sheets };
}

function parseWorksheetXml(xml: string, sharedStrings: string[]): ParsedCell[][] {
  const rows: ParsedCell[][] = [];
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRegex.exec(xml)) !== null) {
    const rowBody = rm[1];
    const rowCells: ParsedCell[] = [];
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
    let cm: RegExpExecArray | null;
    while ((cm = cellRegex.exec(rowBody)) !== null) {
      const attrs = cm[1];
      const inner = cm[2];
      const refMatch = attrs.match(/\br="([A-Z]+)\d+"/);
      const colIdx = refMatch ? colLettersToIndex(refMatch[1]) : rowCells.length;
      const typeMatch = attrs.match(/\bt="([^"]+)"/);
      const cellType = typeMatch ? typeMatch[1] : "n";

      const hasFormula = /<f\b/.test(inner);
      const vMatch = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
      const isMatch = inner.match(/<is>[\s\S]*?<t\b[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);

      let raw = "";
      let hasCachedValue = true;
      if (cellType === "s" && vMatch) {
        const sIdx = Number(vMatch[1]);
        raw = sharedStrings[sIdx] ?? "";
      } else if (cellType === "inlineStr" && isMatch) {
        raw = decodeXmlEntities(isMatch[1]);
      } else if (vMatch) {
        raw = decodeXmlEntities(vMatch[1]);
      } else if (hasFormula) {
        hasCachedValue = false;
      }

      while (rowCells.length < colIdx) {
        rowCells.push({ raw: "", isFormula: false, hasCachedValue: true });
      }
      rowCells[colIdx] = { raw: raw.trim(), isFormula: hasFormula, hasCachedValue };
    }
    if (rowCells.some((c) => c.raw.length > 0 || c.isFormula)) {
      rows.push(rowCells);
    }
  }
  return rows;
}

function colLettersToIndex(letters: string): number {
  let idx = 0;
  for (let i = 0; i < letters.length; i++) {
    idx = idx * 26 + (letters.charCodeAt(i) - 64);
  }
  return idx - 1;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function suggestLeadColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const h of headers) {
    const l = h.toLowerCase().trim();
    if (!mapping.name && /^(name|client|client name|lead|lead name|contact name)$/.test(l)) mapping.name = h;
    else if (!mapping.phone && /^(phone|mobile|tel|contact|whatsapp|phone number)$/.test(l)) mapping.phone = h;
    else if (!mapping.email && /^(email|e-mail|mail)$/.test(l)) mapping.email = h;
    else if (!mapping.requirement && /^(requirement|requirements|note|notes|brief|scope|description)$/.test(l)) mapping.requirement = h;
    else if (!mapping.stage && /^(stage|status|pipeline)$/.test(l)) mapping.stage = h;
    else if (!mapping.owner && /^(owner|assignee|assigned to|manager)$/.test(l)) mapping.owner = h;
    else if (!mapping.nextAction && /^(next action|follow.?up|next step)$/.test(l)) mapping.nextAction = h;
    else if (!mapping.dueDate && /^(due date|follow.?up date|next date|date)$/.test(l)) mapping.dueDate = h;
    else if (!mapping.sourceId && /^(id|source id|external id|lead id)$/.test(l)) mapping.sourceId = h;
  }
  return mapping;
}
