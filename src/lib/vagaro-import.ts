import type { Workbook } from "exceljs";
import { formatPhone } from "./format.ts";

export type VagaroClientRow = {
  name: string;
  phone: string;
  email: string;
  notes: string;
  loyaltyPoints: number;
  createdAt?: string;
  line: number;
};

export type ParseSkip = { line: number; reason: string };

export type VagaroParseResult = {
  rows: VagaroClientRow[];
  skipped: ParseSkip[];
  headers: string[];
};

export type ImportMode = "merge" | "skip" | "add";

type ExcelJSModule = { Workbook: new () => Workbook };

const HEADER_ALIASES: Record<string, string[]> = {
  name: ["name", "customer", "customername", "fullname", "client", "clientname"],
  first: ["firstname", "first", "givenname"],
  last: ["lastname", "last", "surname"],
  email: ["email", "emailaddress", "e-mail", "mail"],
  mobile: ["mobile", "mobilephone", "cell", "cellphone", "cellphonenumber", "primaryphone"],
  phone: ["phone", "phonenumber", "telephone"],
  day: ["day", "dayphone", "daytime", "daytimephone", "workphone", "work"],
  night: ["night", "nightphone", "homephone", "home"],
  notes: ["notes", "customernote", "customernotes", "note", "comments"],
  points: ["pointsearned", "points", "loyalty", "loyaltypoints"],
  since: ["customersince", "created", "dateadded", "createdat"],
  address: ["address", "mailingaddress", "address1", "street"],
  referred: ["referredby", "referral", "referred"],
  birthday: ["birthdate", "birthday", "birth", "dob"],
  tags: ["tags", "tag"],
  lastVisit: ["lastvisited", "lastvisit", "lastappointment"],
};

function keyOf(header: unknown) {
  return String(header ?? "")
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function cell(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date && !Number.isNaN(+value)) return value.toISOString().slice(0, 10);
  return String(value).replace(/^\uFEFF/, "").trim();
}

function pick(record: Record<string, string>, field: keyof typeof HEADER_ALIASES) {
  for (const alias of HEADER_ALIASES[field]) {
    if (record[alias]) return record[alias];
  }
  return "";
}

function prettyName(first: string, last: string, name: string) {
  if (first || last) return [first, last].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const raw = name.replace(/\s+/g, " ").trim();
  const comma = raw.match(/^([^,]+),\s*(.+)$/);
  if (comma) return `${comma[2]} ${comma[1]}`.trim();
  return raw;
}

function digits(phone: string) {
  return phone.replace(/\D/g, "");
}

function parsePoints(raw: string) {
  const n = Number(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function parseSince(raw: string) {
  if (!raw) return undefined;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return undefined;
  return new Date(t).toISOString();
}

function headerScore(row: unknown[]) {
  const keys = row.map(keyOf);
  let hits = 0;
  for (const aliases of Object.values(HEADER_ALIASES)) {
    if (keys.some((k) => aliases.includes(k))) hits += 1;
  }
  return hits;
}

function toRecord(headers: string[], row: unknown[]) {
  const record: Record<string, string> = {};
  headers.forEach((h, i) => {
    const k = keyOf(h);
    if (!k) return;
    const v = cell(row[i]);
    if (v) record[k] = v;
  });
  return record;
}

function rowFromRecord(record: Record<string, string>, line: number): VagaroClientRow | ParseSkip {
  const name = prettyName(pick(record, "first"), pick(record, "last"), pick(record, "name"));
  if (!name) return { line, reason: "Missing name" };

  const phoneRaw =
    pick(record, "mobile") || pick(record, "phone") || pick(record, "day") || pick(record, "night");
  const extras = [
    pick(record, "notes"),
    pick(record, "address") ? `Address: ${pick(record, "address")}` : "",
    pick(record, "birthday") ? `Birthday ${pick(record, "birthday")}` : "",
    pick(record, "referred") ? `Referred by ${pick(record, "referred")}` : "",
    pick(record, "tags") ? `Tags: ${pick(record, "tags")}` : "",
    pick(record, "lastVisit") ? `Last visit ${pick(record, "lastVisit")}` : "",
  ].filter(Boolean);

  return {
    name,
    phone: formatPhone(phoneRaw),
    email: pick(record, "email").toLowerCase(),
    notes: extras.join(" · "),
    loyaltyPoints: parsePoints(pick(record, "points")),
    createdAt: parseSince(pick(record, "since")),
    line,
  };
}

function looksLikeZip(bytes: Uint8Array) {
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function looksLikeOle(bytes: Uint8Array) {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  );
}

function excelCellText(value: unknown): unknown {
  if (value == null) return "";
  if (value instanceof Date) return value;
  if (typeof value !== "object") return value;
  const record = value as {
    richText?: { text: string }[];
    text?: unknown;
    result?: unknown;
    hyperlink?: string;
    error?: string;
  };
  if (Array.isArray(record.richText)) return record.richText.map((part) => part.text).join("");
  if (record.text != null) return record.text;
  if ("result" in record) return excelCellText(record.result);
  if (record.hyperlink) return record.hyperlink;
  if (record.error) return "";
  return "";
}

function excelNamespace(mod: unknown): ExcelJSModule {
  let current: unknown = mod;
  for (let i = 0; i < 4; i++) {
    if (
      current &&
      typeof current === "object" &&
      "Workbook" in current &&
      typeof (current as ExcelJSModule).Workbook === "function"
    ) {
      return current as ExcelJSModule;
    }
    if (current && typeof current === "object" && "default" in current) {
      current = (current as { default: unknown }).default;
      continue;
    }
    break;
  }
  throw new Error("ExcelJS failed to load");
}

async function loadExcelJS(): Promise<ExcelJSModule> {
  const mod = await import("exceljs");
  return excelNamespace(mod);
}

async function rowsFromXlsx(data: ArrayBuffer): Promise<unknown[][]> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data as unknown as Parameters<Workbook["xlsx"]["load"]>[0]);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const table: unknown[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    table.push(values.map(excelCellText));
  });
  return table;
}

function parseDelimited(text: string): string[][] {
  const sample = text.slice(0, 2048);
  const delim = sample.split("\t").length > sample.split(",").length ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let quoted = false;
  const body = text.replace(/^\uFEFF/, "");
  while (i < body.length) {
    const ch = body[i] ?? "";
    if (quoted) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (ch === delim) {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function parseTable(table: unknown[][]): VagaroParseResult {
  if (table.length === 0) return { rows: [], skipped: [{ line: 1, reason: "The file is empty." }], headers: [] };

  let headerIndex = 0;
  let best = 0;
  const scan = Math.min(table.length, 12);
  for (let i = 0; i < scan; i++) {
    const score = headerScore(table[i] ?? []);
    if (score > best) {
      best = score;
      headerIndex = i;
    }
  }
  if (best < 2) {
    return {
      rows: [],
      skipped: [{ line: 1, reason: "Could not find Vagaro columns (Name, Email, Mobile…)." }],
      headers: (table[0] ?? []).map((h) => cell(h)),
    };
  }

  const headers = (table[headerIndex] ?? []).map((h) => cell(h));
  const rows: VagaroClientRow[] = [];
  const skipped: ParseSkip[] = [];
  for (let i = headerIndex + 1; i < table.length; i++) {
    const record = toRecord(headers, table[i] ?? []);
    if (Object.keys(record).length === 0) continue;
    const parsed = rowFromRecord(record, i + 1);
    if ("reason" in parsed) skipped.push(parsed);
    else rows.push(parsed);
  }
  return { rows, skipped, headers };
}

export async function parseVagaroSheet(data: ArrayBuffer | string): Promise<VagaroParseResult> {
  if (typeof data === "string") return parseTable(parseDelimited(data));

  const bytes = new Uint8Array(data);
  if (looksLikeOle(bytes)) {
    return {
      rows: [],
      skipped: [{ line: 1, reason: "Old Excel (.xls) isn't supported. Export .xlsx or CSV from Vagaro." }],
      headers: [],
    };
  }
  if (looksLikeZip(bytes)) {
    const table = await rowsFromXlsx(data);
    if (table.length === 0) {
      return { rows: [], skipped: [{ line: 1, reason: "The file has no sheet." }], headers: [] };
    }
    return parseTable(table);
  }
  const text = new TextDecoder("utf-8").decode(bytes);
  return parseTable(parseDelimited(text));
}

export function matchClient<T extends { name: string; phone: string; email: string }>(
  existing: T[],
  row: Pick<VagaroClientRow, "name" | "phone" | "email">,
) {
  const email = row.email.trim().toLowerCase();
  const phone = digits(row.phone);
  if (email) {
    const hit = existing.find((c) => c.email.trim().toLowerCase() === email);
    if (hit) return hit;
  }
  if (phone.length >= 7) {
    const hit = existing.find((c) => digits(c.phone) === phone);
    if (hit) return hit;
  }
  const name = row.name.trim().toLowerCase();
  if (!email && phone.length < 7 && name) {
    return existing.find((c) => c.name.trim().toLowerCase() === name);
  }
  return undefined;
}
