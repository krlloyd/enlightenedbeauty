import { createServerFn } from "@tanstack/react-start";
import { classifyCallToolError, GoogleDriveTools } from "@/lib/app-data";
import { authMiddleware } from "@/lib/auth/middleware";
import { pickSalonPayload, type SalonPayload } from "@/lib/salon-payload";
import { requireDeskOwner } from "@/lib/studio-members";
import { nid } from "@/lib/utils";
import {
  CLOUD_KIND_LABEL,
  DRIVE_FOLDER_NAME,
  KEEP_CLOUD_FILES,
  cloudFileName,
  extractDriveFiles,
  extractDriveFolder,
  extractDriveId,
  extractDriveText,
  parseCloudKind,
  parseS3ListPage,
  staleRemoteIds,
  type CloudKind,
} from "./salon-cloud-kinds";

export { CLOUD_KIND_LABEL, CLOUD_KINDS, parseCloudKind, type CloudKind } from "./salon-cloud-kinds";

const SALON_ID = "salon";

export type CloudFileSummary = {
  id: string;
  kind: CloudKind;
  name: string;
  note: string;
  createdAt: string;
  clients: number;
  appointments: number;
};

export type CloudStatus = {
  kind: CloudKind;
  autoUpload: boolean;
  lastCloudAt: string | null;
  error: string | null;
  driveFolderName: string | null;
  s3: {
    endpoint: string;
    region: string;
    bucket: string;
    prefix: string;
    accessKeyId: string;
    secretSet: boolean;
  };
  loginRequired: boolean;
  loginUrl: string | null;
  files: CloudFileSummary[];
};

type CloudRow = {
  cloud_kind: string;
  cloud_config: unknown;
  cloud_error: string | null;
  last_cloud_at: string | null;
};

type CloudFileRow = {
  id: string;
  kind: string;
  remote_id: string;
  name: string;
  note: string;
  clients: number;
  appointments: number;
  created_at: string;
};

type StoredConfig = {
  autoUpload?: boolean;
  driveFolderId?: string;
  driveFolderName?: string;
  s3?: {
    endpoint?: string;
    region?: string;
    bucket?: string;
    prefix?: string;
    accessKeyId?: string;
    secretBlob?: string;
  };
};

const globalCloud = globalThis as typeof globalThis & { __ebCloudSecret__?: string };

async function vaultSecret() {
  const fromEnv = process.env.BETTER_AUTH_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (!globalCloud.__ebCloudSecret__) {
    const { randomBytes } = await import("node:crypto");
    globalCloud.__ebCloudSecret__ = randomBytes(32).toString("hex");
  }
  return globalCloud.__ebCloudSecret__;
}

function asIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) return new Date(value).toISOString();
  return null;
}

function asConfig(value: unknown): StoredConfig {
  if (!value || typeof value !== "object") return {};
  return value as StoredConfig;
}

function s3Public(cfg: StoredConfig["s3"]) {
  return {
    endpoint: cfg?.endpoint ?? "",
    region: cfg?.region ?? "auto",
    bucket: cfg?.bucket ?? "",
    prefix: cfg?.prefix ?? "enlightened-beauty",
    accessKeyId: cfg?.accessKeyId ?? "",
    secretSet: Boolean(cfg?.secretBlob),
  };
}

async function loadCloud(sql: Awaited<ReturnType<typeof import("./db").getSql>>) {
  await sql.query(`insert into salon_state (id) values ($1) on conflict (id) do nothing`, [SALON_ID]);
  const rows = await sql.query<CloudRow>(
    `select cloud_kind, cloud_config, cloud_error, last_cloud_at from salon_state where id = $1 limit 1`,
    [SALON_ID],
  );
  const row = rows[0];
  return {
    kind: parseCloudKind(row?.cloud_kind),
    config: asConfig(row?.cloud_config),
    error: row?.cloud_error || null,
    lastCloudAt: asIso(row?.last_cloud_at),
  };
}

async function listFiles(sql: Awaited<ReturnType<typeof import("./db").getSql>>): Promise<CloudFileSummary[]> {
  const rows = await sql.query<CloudFileRow>(
    `select id, kind, remote_id, name, note, clients, appointments, created_at from salon_cloud_files order by created_at desc limit 30`,
  );
  return rows.map((row) => ({
    id: row.id,
    kind: parseCloudKind(row.kind),
    name: row.name,
    createdAt: asIso(row.created_at) ?? new Date().toISOString(),
    note: row.note,
    clients: Number(row.clients) || 0,
    appointments: Number(row.appointments) || 0,
  }));
}

async function setCloudError(sql: Awaited<ReturnType<typeof import("./db").getSql>>, message: string | null) {
  await sql.query(`update salon_state set cloud_error = $1 where id = $2`, [message, SALON_ID]);
}

async function pruneCloudFiles(sql: Awaited<ReturnType<typeof import("./db").getSql>>) {
  const extra = await sql.query<{ id: string }>(
    `select id from salon_cloud_files order by created_at desc offset $1`,
    [KEEP_CLOUD_FILES],
  );
  for (const row of extra) {
    await sql.query(`delete from salon_cloud_files where id = $1`, [row.id]);
  }
}

async function rememberFile(
  sql: Awaited<ReturnType<typeof import("./db").getSql>>,
  kind: CloudKind,
  remoteId: string,
  name: string,
  note: string,
  payload: SalonPayload | null,
) {
  const found = await sql.query<{ id: string }>(
    `select id from salon_cloud_files where remote_id = $1 limit 1`,
    [remoteId],
  );
  const clients = payload?.clients.length ?? 0;
  const appointments = payload?.appointments.length ?? 0;
  if (found[0]) {
    if (!payload) return;
    await sql.query(
      `update salon_cloud_files set name = $1, note = $2, clients = $3, appointments = $4, created_at = now() where id = $5`,
      [name, note, clients, appointments, found[0].id],
    );
  } else {
    await sql.query(
      `insert into salon_cloud_files (id, kind, remote_id, name, note, clients, appointments) values ($1, $2, $3, $4, $5, $6, $7)`,
      [nid(), kind, remoteId, name, note, clients, appointments],
    );
  }
  await pruneCloudFiles(sql);
  if (payload) {
    await sql.query(`update salon_state set last_cloud_at = now(), cloud_error = null where id = $1`, [SALON_ID]);
  }
}

function driveMessage(result: { ok: boolean; errorMessage?: string; loginRequired?: boolean }) {
  const classified = classifyCallToolError({
    ok: result.ok,
    data: null,
    errorMessage: result.errorMessage,
    loginRequired: result.loginRequired,
  });
  if (classified?.kind === "login") {
    return "Open the site through Grok and continue so Drive can receive copies.";
  }
  if (classified?.kind === "not_connected") {
    return "Connect Google Drive in Grok, then try again.";
  }
  if (classified?.kind === "scope_denied") {
    return "Drive write isn't available on this preview. Use a bucket on your own server, or download the JSON.";
  }
  return classified?.message ?? result.errorMessage ?? "Could not reach Google Drive.";
}

async function callDrive(tool: string, args: Record<string, unknown>) {
  const { callTool } = await import("@/lib/app-data/client.server");
  const { ConnectorType } = await import("@/lib/app-data");
  return callTool(tool, args, { connectorType: ConnectorType.GoogleDrive });
}

async function ensureDriveFolder(folderId?: string, folderName?: string) {
  if (folderId) {
    return { id: folderId, name: folderName || DRIVE_FOLDER_NAME, loginRequired: false, loginUrl: null as string | null };
  }
  const search = await callDrive(GoogleDriveTools.search, {
    query: DRIVE_FOLDER_NAME,
    q: DRIVE_FOLDER_NAME,
    name: DRIVE_FOLDER_NAME,
  });
  if (search.loginRequired) {
    return { id: "", name: DRIVE_FOLDER_NAME, loginRequired: true, loginUrl: search.loginUrl ?? null };
  }
  const found = extractDriveFolder(search.data);
  if (found) return { id: found.id, name: found.name || DRIVE_FOLDER_NAME, loginRequired: false, loginUrl: null };
  const created = await callDrive(GoogleDriveTools.createFolder, { name: DRIVE_FOLDER_NAME, title: DRIVE_FOLDER_NAME });
  if (created.loginRequired) {
    return { id: "", name: DRIVE_FOLDER_NAME, loginRequired: true, loginUrl: created.loginUrl ?? null };
  }
  const id = extractDriveId(created.data);
  if (!created.ok || !id) throw new Error(driveMessage(created));
  return { id, name: DRIVE_FOLDER_NAME, loginRequired: false, loginUrl: null as string | null };
}

async function putDriveFile(folderId: string, name: string, json: string) {
  const args = {
    name,
    title: name,
    mime_type: "application/json",
    mimeType: "application/json",
    content_mime_type: "application/json",
    contentMimeType: "application/json",
    text_content: json,
    textContent: json,
    content: json,
    parent_id: folderId,
    parentId: folderId,
    folder_id: folderId,
    folderId: folderId,
  };
  const tools = ["google_drive_create_file", "google_drive_upload_file", "google_drive_write_file"];
  let last = { ok: false as boolean, data: null as unknown, errorMessage: "Could not upload to Google Drive.", loginRequired: false, loginUrl: undefined as string | undefined };
  for (const tool of tools) {
    const result = await callDrive(tool, args);
    if (result.loginRequired) return result;
    const id = extractDriveId(result.data);
    if (result.ok && id) return { ...result, ok: true as const, data: { id } };
    last = {
      ok: false,
      data: null,
      errorMessage: result.errorMessage || last.errorMessage,
      loginRequired: Boolean(result.loginRequired),
      loginUrl: result.loginUrl,
    };
  }
  return { ...last, ok: false, errorMessage: driveMessage(last) };
}

async function resolvedS3(cfg: StoredConfig["s3"]) {
  if (!cfg?.bucket || !cfg.accessKeyId || !cfg.secretBlob) return null;
  const { decryptSecret } = await import("./salon-cloud-util");
  let secret = "";
  try {
    secret = decryptSecret(cfg.secretBlob, await vaultSecret());
  } catch {
    return null;
  }
  if (!secret) return null;
  return {
    endpoint: cfg.endpoint ?? "",
    region: cfg.region || "auto",
    bucket: cfg.bucket,
    prefix: cfg.prefix || "enlightened-beauty",
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: secret,
  };
}

async function s3Send(
  cfg: Awaited<ReturnType<typeof resolvedS3>> & {},
  method: "PUT" | "GET",
  key: string,
  body = "",
  query?: Record<string, string>,
) {
  if (!cfg) throw new Error("The bucket credentials are missing.");
  const { buildS3Request } = await import("./salon-cloud-util");
  const req = buildS3Request(cfg, method, key, body, new Date(), query);
  const res = await fetch(req.url, {
    method,
    headers: {
      "x-amz-content-sha256": req.headers["x-amz-content-sha256"] ?? "",
      "x-amz-date": req.headers["x-amz-date"] ?? "",
      authorization: req.headers.authorization ?? "",
      "content-type": "application/json",
    },
    body: method === "PUT" ? body : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Bucket returned ${res.status}. ${text.slice(0, 160)}`);
  return text;
}

async function dropMissing(
  sql: Awaited<ReturnType<typeof import("./db").getSql>>,
  kind: CloudKind,
  remoteIds: string[],
) {
  const rows = await sql.query<{ id: string; remote_id: string }>(
    `select id, remote_id from salon_cloud_files where kind = $1`,
    [kind],
  );
  const gone = staleRemoteIds(
    rows.map((row) => row.remote_id),
    remoteIds,
  );
  for (const remoteId of gone) {
    await sql.query(`delete from salon_cloud_files where kind = $1 and remote_id = $2`, [kind, remoteId]);
  }
}

function asLoginState(result: { loginRequired?: boolean; loginUrl?: string | null } | null | undefined) {
  return {
    loginRequired: Boolean(result?.loginRequired),
    loginUrl: result?.loginUrl ?? null,
  };
}

async function indexRemoteCopies(
  sql: Awaited<ReturnType<typeof import("./db").getSql>>,
  kind: CloudKind,
  config: StoredConfig,
) {
  if (kind === "drive") {
    const folder = await ensureDriveFolder(config.driveFolderId, config.driveFolderName);
    if (folder.loginRequired) return folder;
    if (folder.id && folder.id !== config.driveFolderId) {
      const next = { ...config, driveFolderId: folder.id, driveFolderName: folder.name };
      await sql.query(`update salon_state set cloud_config = $1::jsonb where id = $2`, [JSON.stringify(next), SALON_ID]);
    }
    const listed = await callDrive(GoogleDriveTools.listFolder, {
      folder_id: folder.id,
      folderId: folder.id,
      id: folder.id,
    });
    if (listed.loginRequired) return listed;
    let files = listed.ok ? extractDriveFiles(listed.data) : [];
    let listingOk = Boolean(listed.ok);
    if (!files.length) {
      const search = await callDrive(GoogleDriveTools.search, {
        query: "enlightened-beauty",
        q: "enlightened-beauty",
        folder_id: folder.id,
        folderId: folder.id,
      });
      if (search.loginRequired) return search;
      if (search.ok) {
        files = extractDriveFiles(search.data);
        listingOk = true;
      }
    }
    if (!listingOk) throw new Error(driveMessage(listed));
    for (const file of files) {
      await rememberFile(sql, "drive", file.id, file.name, "Found in Drive", null);
    }
    await dropMissing(sql, "drive", files.map((file) => file.id));
    return { loginRequired: false, loginUrl: null as string | null };
  }
  if (kind === "s3") {
    const s3 = await resolvedS3(config.s3);
    if (!s3) return { loginRequired: false, loginUrl: null as string | null };
    const keys = await listS3JsonKeys(s3);
    for (const key of keys) {
      const name = key.split("/").pop() || key;
      await rememberFile(sql, "s3", key, name, "Found in bucket", null);
    }
    await dropMissing(sql, "s3", keys);
  }
  return { loginRequired: false, loginUrl: null as string | null };
}

async function listS3JsonKeys(s3: NonNullable<Awaited<ReturnType<typeof resolvedS3>>>) {
  const prefix = `${s3.prefix.replace(/\/+$/, "")}/`.replace(/^\/+/, "");
  const keys: string[] = [];
  let token: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const query: Record<string, string> = {
      "list-type": "2",
      prefix,
      "max-keys": "1000",
    };
    if (token) query["continuation-token"] = token;
    const xml = await s3Send(s3, "GET", "", "", query);
    const listed = parseS3ListPage(xml);
    for (const key of listed.keys) {
      const name = key.split("/").pop() || key;
      if (/\.json$/i.test(name)) keys.push(key);
    }
    if (!listed.nextToken) break;
    token = listed.nextToken;
  }
  return keys;
}

function statusFrom(
  kind: CloudKind,
  config: StoredConfig,
  error: string | null,
  lastCloudAt: string | null,
  files: CloudFileSummary[],
  login?: { loginRequired: boolean; loginUrl: string | null },
): CloudStatus {
  return {
    kind,
    autoUpload: config.autoUpload !== false,
    lastCloudAt,
    error,
    driveFolderName: kind === "drive" && config.driveFolderId ? config.driveFolderName || DRIVE_FOLDER_NAME : null,
    s3: s3Public(config.s3),
    loginRequired: Boolean(login?.loginRequired),
    loginUrl: login?.loginUrl ?? null,
    files,
  };
}

export async function pushCloudCopy(
  sql: Awaited<ReturnType<typeof import("./db").getSql>>,
  payload: SalonPayload,
  note: string,
): Promise<{ ok: boolean; message?: string }> {
  const state = await loadCloud(sql);
  if (state.kind === "off") return { ok: true };
  if (state.config.autoUpload === false) return { ok: true };
  const json = JSON.stringify(payload, null, 2);
  const name = cloudFileName();
  try {
    if (state.kind === "drive") {
      const folder = await ensureDriveFolder(state.config.driveFolderId, state.config.driveFolderName);
      if (folder.loginRequired) {
        await setCloudError(sql, "Google Drive needs a Grok sign-in before it can store copies.");
        return { ok: false, message: "Google Drive needs a Grok sign-in before it can store copies." };
      }
      if (folder.id !== state.config.driveFolderId) {
        const next = { ...state.config, driveFolderId: folder.id, driveFolderName: folder.name };
        await sql.query(`update salon_state set cloud_config = $1::jsonb where id = $2`, [JSON.stringify(next), SALON_ID]);
      }
      const put = await putDriveFile(folder.id, name, json);
      if (put.loginRequired) {
        await setCloudError(sql, "Google Drive needs a Grok sign-in before it can store copies.");
        return { ok: false, message: "Google Drive needs a Grok sign-in before it can store copies." };
      }
      if (!put.ok) {
        const message = put.errorMessage || "Could not upload to Google Drive.";
        await setCloudError(sql, message);
        return { ok: false, message };
      }
      const remoteId = extractDriveId(put.data) || name;
      await rememberFile(sql, "drive", remoteId, name, note, payload);
      return { ok: true };
    }
    const s3 = await resolvedS3(state.config.s3);
    if (!s3) {
      const message = "The bucket is missing a key or secret.";
      await setCloudError(sql, message);
      return { ok: false, message };
    }
    const objectKey = `${s3.prefix.replace(/\/+$/, "")}/${name}`.replace(/^\/+/, "");
    await s3Send(s3, "PUT", objectKey, json);
    await rememberFile(sql, "s3", objectKey, name, note, payload);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cloud copy failed.";
    await setCloudError(sql, message);
    return { ok: false, message };
  }
}

export const getCloudStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<CloudStatus> => {
    const { getSql } = await import("./db");
    const sql = await getSql();
    await requireDeskOwner(sql, context.userId);
    let state = await loadCloud(sql);
    if (state.kind === "s3") {
      try {
        await indexRemoteCopies(sql, "s3", state.config);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not list the bucket.";
        await setCloudError(sql, message);
      }
      state = await loadCloud(sql);
    }
    const files = await listFiles(sql);
    return statusFrom(state.kind, state.config, state.error, state.lastCloudAt, files);
  });

export const saveCloudSettings = createServerFn({ method: "POST" })
  .validator((d: {
    kind: CloudKind;
    autoUpload?: boolean;
    s3?: {
      endpoint?: string;
      region?: string;
      bucket?: string;
      prefix?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
    };
  }) => ({
    kind: parseCloudKind(d?.kind),
    autoUpload: d?.autoUpload !== false,
    s3: d?.s3,
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<CloudStatus> => {
    const { getSql } = await import("./db");
    const sql = await getSql();
    await requireDeskOwner(sql, context.userId);
    const current = await loadCloud(sql);
    const s3In = data.s3;
    const prev = current.config.s3 ?? {};
    let secretBlob = prev.secretBlob ?? "";
    const nextSecret = s3In?.secretAccessKey?.trim() ?? "";
    if (nextSecret) {
      const { encryptSecret } = await import("./salon-cloud-util");
      secretBlob = encryptSecret(nextSecret, await vaultSecret());
    }
    const config: StoredConfig = {
      ...current.config,
      autoUpload: data.autoUpload,
      s3:
        data.kind === "s3"
          ? {
              endpoint: String(s3In?.endpoint ?? prev.endpoint ?? "").trim(),
              region: String(s3In?.region ?? prev.region ?? "auto").trim() || "auto",
              bucket: String(s3In?.bucket ?? prev.bucket ?? "").trim(),
              prefix: String(s3In?.prefix ?? prev.prefix ?? "enlightened-beauty").trim() || "enlightened-beauty",
              accessKeyId: String(s3In?.accessKeyId ?? prev.accessKeyId ?? "").trim(),
              secretBlob,
            }
          : prev,
    };
    if (data.kind === "s3" && (!config.s3?.bucket || !config.s3.accessKeyId || !config.s3.secretBlob)) {
      throw new Error("Bucket, access key, and secret are required.");
    }
    await sql.query(
      `update salon_state set cloud_kind = $1, cloud_config = $2::jsonb, cloud_error = null, updated_at = now() where id = $3`,
      [data.kind, JSON.stringify(config), SALON_ID],
    );
    if (data.kind === "s3") {
      try {
        await indexRemoteCopies(sql, "s3", config);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not list the bucket.";
        await setCloudError(sql, message);
      }
    }
    const next = await loadCloud(sql);
    const files = await listFiles(sql);
    return statusFrom(data.kind, next.config, next.error, next.lastCloudAt, files);
  });

export const connectDriveFolder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<CloudStatus> => {
    const { getSql } = await import("./db");
    const sql = await getSql();
    await requireDeskOwner(sql, context.userId);
    const current = await loadCloud(sql);
    const folder = await ensureDriveFolder(current.config.driveFolderId, current.config.driveFolderName);
    if (folder.loginRequired) {
      await sql.query(`update salon_state set cloud_kind = $1, updated_at = now() where id = $2`, ["drive", SALON_ID]);
      const files = await listFiles(sql);
      return statusFrom("drive", current.config, null, current.lastCloudAt, files, folder);
    }
    const config: StoredConfig = {
      ...current.config,
      autoUpload: current.config.autoUpload !== false,
      driveFolderId: folder.id,
      driveFolderName: folder.name,
    };
    await sql.query(
      `update salon_state set cloud_kind = $1, cloud_config = $2::jsonb, cloud_error = null, updated_at = now() where id = $3`,
      ["drive", JSON.stringify(config), SALON_ID],
    );
    const listed = await indexRemoteCopies(sql, "drive", config);
    const next = await loadCloud(sql);
    const files = await listFiles(sql);
    return statusFrom("drive", next.config, next.error, next.lastCloudAt, files, asLoginState(listed));
  });

export const refreshCloudIndex = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<CloudStatus> => {
    const { getSql } = await import("./db");
    const sql = await getSql();
    await requireDeskOwner(sql, context.userId);
    const current = await loadCloud(sql);
    if (current.kind === "off") {
      const files = await listFiles(sql);
      return statusFrom(current.kind, current.config, current.error, current.lastCloudAt, files);
    }
    try {
      const listed = await indexRemoteCopies(sql, current.kind, current.config);
      const next = await loadCloud(sql);
      const files = await listFiles(sql);
      return statusFrom(next.kind, next.config, next.error, next.lastCloudAt, files, asLoginState(listed));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not refresh off-site copies.";
      await setCloudError(sql, message);
      const next = await loadCloud(sql);
      const files = await listFiles(sql);
      return statusFrom(next.kind, next.config, next.error, next.lastCloudAt, files);
    }
  });

export const sendCloudCopy = createServerFn({ method: "POST" })
  .validator((d: { payload: SalonPayload; note?: string }) => {
    const payload = pickSalonPayload(d?.payload ?? {});
    if (!payload) throw new Error("Nothing to send.");
    return { payload, note: String(d?.note ?? "Manual cloud copy").slice(0, 120) };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<CloudStatus> => {
    const { getSql } = await import("./db");
    const sql = await getSql();
    await requireDeskOwner(sql, context.userId);
    const current = await loadCloud(sql);
    if (current.kind === "off") throw new Error("Pick Google Drive or a bucket first.");
    const previous = current.config.autoUpload;
    current.config.autoUpload = true;
    await sql.query(`update salon_state set cloud_config = $1::jsonb where id = $2`, [
      JSON.stringify(current.config),
      SALON_ID,
    ]);
    const pushed = await pushCloudCopy(sql, data.payload, data.note);
    if (previous === false) {
      current.config.autoUpload = false;
      await sql.query(`update salon_state set cloud_config = $1::jsonb where id = $2`, [
        JSON.stringify(current.config),
        SALON_ID,
      ]);
    }
    const next = await loadCloud(sql);
    const files = await listFiles(sql);
    if (!pushed.ok) throw new Error(pushed.message || "Could not send that copy.");
    return statusFrom(next.kind, next.config, next.error, next.lastCloudAt, files);
  });

export const restoreCloudCopy = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => {
    if (!d?.id) throw new Error("Missing cloud copy.");
    return { id: String(d.id) };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<SalonPayload> => {
    const { getSql } = await import("./db");
    const sql = await getSql();
    await requireDeskOwner(sql, context.userId);
    const rows = await sql.query<CloudFileRow>(
      `select id, kind, remote_id, name, note, clients, appointments, created_at from salon_cloud_files where id = $1 limit 1`,
      [data.id],
    );
    const row = rows[0];
    if (!row) throw new Error("That cloud copy is gone.");
    const kind = parseCloudKind(row.kind);
    let raw = "";
    if (kind === "drive") {
      const read = await callDrive(GoogleDriveTools.readFile, {
        file_id: row.remote_id,
        fileId: row.remote_id,
        id: row.remote_id,
      });
      if (read.loginRequired) throw new Error("Google Drive needs a Grok sign-in to restore that copy.");
      raw = extractDriveText(read.data) ?? "";
      if (!read.ok || !raw) {
        const message = driveMessage(read);
        if (/not found|404|trashed|does not exist/i.test(`${read.errorMessage ?? ""} ${message}`)) {
          await sql.query(`delete from salon_cloud_files where id = $1`, [data.id]);
        }
        throw new Error(message || "That copy is no longer in Drive.");
      }
    } else if (kind === "s3") {
      const state = await loadCloud(sql);
      const s3 = await resolvedS3(state.config.s3);
      if (!s3) throw new Error("The bucket credentials are missing.");
      try {
        raw = await s3Send(s3, "GET", row.remote_id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not read that copy.";
        if (/\b404\b/.test(message) || /NoSuchKey/i.test(message)) {
          await sql.query(`delete from salon_cloud_files where id = $1`, [data.id]);
          throw new Error("That copy is no longer in the bucket.");
        }
        throw new Error(message);
      }
    } else {
      throw new Error("That copy has no cloud destination.");
    }
    let parsed: unknown = raw;
    try {
      parsed = JSON.parse(raw);
    } catch {
      /* already an object from Drive */
    }
    const payload = pickSalonPayload((asObjectSafe(parsed) ?? {}) as Partial<SalonPayload>);
    if (!payload) throw new Error("That file is not a salon backup.");
    return payload;
  });

function asObjectSafe(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
