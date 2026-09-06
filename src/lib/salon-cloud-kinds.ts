export const CLOUD_KINDS = ["off", "drive", "s3"] as const;
export type CloudKind = (typeof CLOUD_KINDS)[number];

export const CLOUD_KIND_LABEL: Record<CloudKind, string> = {
  off: "This server only",
  drive: "Google Drive",
  s3: "S3-compatible bucket",
};

export const DRIVE_FOLDER_NAME = "Enlightened Beauty backups";
export const KEEP_CLOUD_FILES = 30;

export function parseCloudKind(value: unknown): CloudKind {
  return typeof value === "string" && (CLOUD_KINDS as readonly string[]).includes(value)
    ? (value as CloudKind)
    : "off";
}

export function cloudFileName(at = new Date()) {
  const stamp = at.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `enlightened-beauty-${stamp}.json`;
}

export type DriveItem = { id: string; name: string; mime: string };

function asDriveItem(row: Record<string, unknown>): DriveItem | null {
  const id = typeof row.id === "string" && row.id ? row.id : "";
  if (!id) return null;
  const name =
    (typeof row.name === "string" && row.name) ||
    (typeof row.title === "string" && row.title) ||
    (typeof row.fileName === "string" && row.fileName) ||
    "";
  const mime =
    (typeof row.mimeType === "string" && row.mimeType) ||
    (typeof row.mime_type === "string" && row.mime_type) ||
    "";
  return { id, name, mime };
}

export function collectDriveItems(data: unknown): DriveItem[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data.flatMap(collectDriveItems);
  if (typeof data !== "object") return [];
  const row = data as Record<string, unknown>;
  const self = asDriveItem(row);
  const nested = [
    row.files,
    row.items,
    row.contents,
    row.folders,
    row.file,
    row.folder,
    row.data,
    row.result,
    row.documents,
  ].flatMap((value) => (value == null ? [] : collectDriveItems(value)));
  return self ? [self, ...nested] : nested;
}

export function extractDriveId(data: unknown): string | null {
  return collectDriveItems(data)[0]?.id ?? null;
}

export function extractDriveFolder(data: unknown): { id: string; name: string } | null {
  const items = collectDriveItems(data);
  const named = items.find((item) => item.name === DRIVE_FOLDER_NAME);
  if (named) return { id: named.id, name: named.name };
  const folder = items.find((item) => /folder/i.test(item.mime));
  if (folder) return { id: folder.id, name: folder.name || DRIVE_FOLDER_NAME };
  return items[0] ? { id: items[0].id, name: items[0].name || DRIVE_FOLDER_NAME } : null;
}

export function extractDriveFiles(data: unknown): { id: string; name: string }[] {
  const seen = new Set<string>();
  const files: { id: string; name: string }[] = [];
  for (const item of collectDriveItems(data)) {
    if (/folder/i.test(item.mime)) continue;
    if (!/\.json$/i.test(item.name) && !/enlightened-beauty/i.test(item.name)) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    files.push({ id: item.id, name: item.name || item.id });
  }
  return files;
}

export function extractDriveText(data: unknown): string | null {
  if (typeof data === "string" && data.trim()) return data;
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  for (const key of ["text", "content", "text_content", "body", "data"]) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
    if (value && typeof value === "object") {
      const nested = extractDriveText(value);
      if (nested) return nested;
    }
  }
  return null;
}

export function decodeXmlText(value: string) {
  return value
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'/g, "'");
}

export function parseS3List(xml: string) {
  const keys: string[] = [];
  const re = /<Key>([^<]+)<\/Key>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const key = decodeXmlText(match[1]);
    if (key && !key.endsWith("/")) keys.push(key);
  }
  return keys;
}

export function parseS3ListPage(xml: string): { keys: string[]; nextToken: string | null } {
  const truncated = /<IsTruncated>\s*true\s*<\/IsTruncated>/i.test(xml);
  const token = xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/i);
  return {
    keys: parseS3List(xml),
    nextToken: truncated && token?.[1] ? decodeXmlText(token[1]) : null,
  };
}

export function staleRemoteIds(local: string[], remote: string[]): string[] {
  const live = new Set(remote);
  return local.filter((id) => !live.has(id));
}
