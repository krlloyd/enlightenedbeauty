import * as XLSX from "xlsx";
import { formatPhone } from "./format";

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

export function parseVagaroSheet(data: ArrayBuffer | string): VagaroParseResult {
  const workbook = typeof data === "string"
    ? XLSX.read(data, { type: "string", cellDates: true })
    : XLSX.read(data, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { rows: [], skipped: [{ line: 1, reason: "The file has no sheet." }], headers: [] };

  const table = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
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
