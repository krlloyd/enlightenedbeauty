import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

export {
  CLOUD_KIND_LABEL,
  CLOUD_KINDS,
  DRIVE_FOLDER_NAME,
  KEEP_CLOUD_FILES,
  cloudFileName,
  collectDriveItems,
  extractDriveFiles,
  extractDriveFolder,
  extractDriveId,
  extractDriveText,
  parseCloudKind,
  parseS3List,
  parseS3ListPage,
  staleRemoteIds,
  type CloudKind,
} from "./salon-cloud-kinds.ts";

export type S3Settings = {
  endpoint: string;
  region: string;
  bucket: string;
  prefix: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export function encryptSecret(plain: string, secret: string) {
  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(blob: string, secret: string) {
  const buf = Buffer.from(blob, "base64");
  if (buf.length < 29) throw new Error("Cloud secret is unreadable.");
  const key = createHash("sha256").update(secret).digest();
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

function sha256Hex(data: string | Buffer) {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string) {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function encodeS3Key(key: string) {
  return key
    .split("/")
    .map((part) => encodeURIComponent(part).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`))
    .join("/");
}

function canonicalQuery(query?: Record<string, string>) {
  if (!query) return "";
  return Object.keys(query)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key] ?? "")}`)
    .join("&");
}

export function buildS3Request(
  cfg: S3Settings,
  method: "PUT" | "GET",
  key: string,
  body: string,
  now: Date,
  query?: Record<string, string>,
) {
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const dateStamp = amzDate.slice(0, 8);
  const region = cfg.region.trim() || "auto";
  const payloadHash = sha256Hex(method === "PUT" ? body : "");
  const custom = cfg.endpoint.trim();
  let host: string;
  let path: string;
  let origin: string;
  if (custom) {
    const url = new URL(/^https?:\/\//i.test(custom) ? custom : `https://${custom}`);
    host = url.host;
    origin = url.origin;
    path = key ? `/${encodeURIComponent(cfg.bucket)}/${encodeS3Key(key)}` : `/${encodeURIComponent(cfg.bucket)}`;
  } else {
    host = `${cfg.bucket}.s3.${region}.amazonaws.com`;
    origin = `https://${host}`;
    path = key ? `/${encodeS3Key(key)}` : "/";
  }
  const queryString = canonicalQuery(query);
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonical = `${method}\n${path}\n${queryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256Hex(canonical)}`;
  const kDate = hmac(`AWS4${cfg.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");
  return {
    url: `${origin}${path}${queryString ? `?${queryString}` : ""}`,
    amzDate,
    headers: {
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "content-type": "application/json",
    } as Record<string, string>,
  };
}
