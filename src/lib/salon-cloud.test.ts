import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildS3Request,
  cloudFileName,
  decryptSecret,
  encryptSecret,
  extractDriveFiles,
  extractDriveFolder,
  extractDriveId,
  extractDriveText,
  parseCloudKind,
  parseS3List,
  parseS3ListPage,
  staleRemoteIds,
} from "./salon-cloud-util.ts";

describe("cloud backup helpers", () => {
  it("parses destination kinds", () => {
    assert.equal(parseCloudKind("drive"), "drive");
    assert.equal(parseCloudKind("s3"), "s3");
    assert.equal(parseCloudKind("nope"), "off");
  });

  it("names JSON copies with a stable prefix", () => {
    const name = cloudFileName(new Date("2026-09-06T22:30:00.000Z"));
    assert.equal(name.startsWith("enlightened-beauty-2026-09-06T22-30-00"), true);
    assert.equal(name.endsWith(".json"), true);
  });

  it("round-trips a bucket secret", () => {
    const blob = encryptSecret("super-secret", "desk-key");
    assert.notEqual(blob, "super-secret");
    assert.equal(decryptSecret(blob, "desk-key"), "super-secret");
    assert.throws(() => decryptSecret(blob, "other-key"));
  });

  it("signs a path-style S3 PUT", () => {
    const req = buildS3Request(
      {
        endpoint: "https://abc.r2.cloudflarestorage.com",
        region: "auto",
        bucket: "salon",
        prefix: "backups",
        accessKeyId: "AKIATEST",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      },
      "PUT",
      "backups/book.json",
      "{\"ok\":true}",
      new Date("2026-09-06T22:30:00.000Z"),
    );
    assert.equal(req.url, "https://abc.r2.cloudflarestorage.com/salon/backups/book.json");
    assert.match(req.headers.authorization, /^AWS4-HMAC-SHA256 Credential=AKIATEST\//);
    assert.equal(req.headers["x-amz-date"], "20260906T223000Z");
    assert.equal(req.headers["x-amz-content-sha256"]?.length, 64);
  });

  it("signs a path-style S3 list", () => {
    const req = buildS3Request(
      {
        endpoint: "https://abc.r2.cloudflarestorage.com",
        region: "auto",
        bucket: "salon",
        prefix: "enlightened-beauty",
        accessKeyId: "AKIATEST",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      },
      "GET",
      "",
      "",
      new Date("2026-09-06T22:30:00.000Z"),
      { "list-type": "2", prefix: "enlightened-beauty/", "max-keys": "30" },
    );
    assert.equal(
      req.url,
      "https://abc.r2.cloudflarestorage.com/salon?list-type=2&max-keys=30&prefix=enlightened-beauty%2F",
    );
  });

  it("reads Drive ids, folders, files, and text from mixed payloads", () => {
    assert.equal(extractDriveId({ folder: { id: "fold1" } }), "fold1");
    assert.equal(extractDriveId({ files: [{ id: "file9" }] }), "file9");
    assert.equal(extractDriveText({ content: { text: "{}" } }), "{}");
    assert.deepEqual(extractDriveFolder({ files: [{ id: "f1", name: "Enlightened Beauty backups", mimeType: "application/vnd.google-apps.folder" }] }), {
      id: "f1",
      name: "Enlightened Beauty backups",
    });
    assert.deepEqual(
      extractDriveFiles({
        files: [
          { id: "a", name: "enlightened-beauty-2026.json" },
          { id: "b", name: "notes.txt" },
          { id: "c", name: "folder", mimeType: "application/vnd.google-apps.folder" },
        ],
      }),
      [{ id: "a", name: "enlightened-beauty-2026.json" }],
    );
  });

  it("parses S3 list XML keys", () => {
    const xml =
      "<ListBucketResult><Contents><Key>enlightened-beauty/one.json</Key></Contents><Contents><Key>enlightened-beauty/</Key></Contents></ListBucketResult>";
    assert.deepEqual(parseS3List(xml), ["enlightened-beauty/one.json"]);
  });

  it("reads a truncated S3 list page", () => {
    const xml =
      "<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>token&2</NextContinuationToken><Contents><Key>enlightened-beauty/one.json</Key></Contents></ListBucketResult>";
    assert.deepEqual(parseS3ListPage(xml), {
      keys: ["enlightened-beauty/one.json"],
      nextToken: "token&2",
    });
  });

  it("drops catalog ids that are gone from the bucket", () => {
    assert.deepEqual(staleRemoteIds(["keep.json", "gone.json", "also-gone.json"], ["keep.json"]), [
      "gone.json",
      "also-gone.json",
    ]);
    assert.deepEqual(staleRemoteIds(["a.json"], []), ["a.json"]);
    assert.deepEqual(staleRemoteIds([], ["a.json"]), []);
  });
});
