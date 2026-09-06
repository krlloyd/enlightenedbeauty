import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HSTS_VALUE,
  hostnameOf,
  httpsRedirectLocation,
  httpsResponseHeaders,
  isLoopbackHost,
  publicOrigin,
  publicOriginFromRequest,
  viewFromHeaders,
} from "./https.ts";

function view(host: string, proto: "" | "http" | "https", path = "/book") {
  return { host, forwardedProto: proto, path };
}

describe("hostnameOf / isLoopbackHost", () => {
  it("strips ports and brackets", () => {
    assert.equal(hostnameOf("127.0.0.1:8080"), "127.0.0.1");
    assert.equal(hostnameOf("[::1]:8080"), "::1");
    assert.equal(hostnameOf("enlightenedbeauty.grok.me"), "enlightenedbeauty.grok.me");
  });

  it("treats loopback and wildcard binds as local", () => {
    assert.equal(isLoopbackHost("localhost:8080"), true);
    assert.equal(isLoopbackHost("127.0.0.1"), true);
    assert.equal(isLoopbackHost("[::1]:8080"), true);
    assert.equal(isLoopbackHost("0.0.0.0:8080"), true);
    assert.equal(isLoopbackHost("preview.grok-sandbox.com"), false);
    assert.equal(isLoopbackHost("enlightenedbeauty.grok.me"), false);
  });
});

describe("httpsRedirectLocation", () => {
  it("never redirects loopback, even with x-forwarded-proto: http", () => {
    assert.equal(httpsRedirectLocation(view("127.0.0.1:8080", "http")), null);
    assert.equal(httpsRedirectLocation(view("localhost:8080", "http")), null);
    assert.equal(httpsRedirectLocation(view("[::1]:8080", "http")), null);
  });

  it("never redirects the live-preview sandbox guest host", () => {
    assert.equal(httpsRedirectLocation(view("guest.grok-sandbox.com", "http", "/studio")), null);
    assert.equal(httpsRedirectLocation(view("abc.preview.grok-sandbox.com", "http")), null);
  });

  it("never redirects when the proxy did not set a proto (live preview bind)", () => {
    assert.equal(httpsRedirectLocation(view("guest.grok-sandbox.com", "")), null);
    assert.equal(httpsRedirectLocation(view("enlightenedbeauty.grok.me", "")), null);
  });

  it("never redirects already-https traffic", () => {
    assert.equal(httpsRedirectLocation(view("enlightenedbeauty.grok.me", "https", "/studio")), null);
  });

  it("301s public HTTP (via forwarded proto) to the https URL", () => {
    assert.equal(
      httpsRedirectLocation(view("enlightenedbeauty.grok.me", "http", "/book?s=cut")),
      "https://enlightenedbeauty.grok.me/book?s=cut",
    );
  });
});

describe("publicOrigin", () => {
  it("forces https for public hosts", () => {
    assert.equal(publicOrigin(view("enlightenedbeauty.grok.me", "http")), "https://enlightenedbeauty.grok.me");
    assert.equal(publicOrigin(view("enlightenedbeauty.grok.me", "")), "https://enlightenedbeauty.grok.me");
  });

  it("keeps loopback on the real proto", () => {
    assert.equal(publicOrigin(view("127.0.0.1:8080", ""), "http"), "http://127.0.0.1:8080");
    assert.equal(publicOrigin(view("localhost:8080", "https"), "http"), "https://localhost:8080");
  });
});

describe("httpsResponseHeaders", () => {
  it("sets HSTS on https, and CSP upgrade only when asked", () => {
    assert.deepEqual(httpsResponseHeaders(view("enlightenedbeauty.grok.me", "https")), {
      "Strict-Transport-Security": HSTS_VALUE,
    });
    assert.deepEqual(httpsResponseHeaders(view("enlightenedbeauty.grok.me", "https"), { upgradeInsecure: true }), {
      "Strict-Transport-Security": HSTS_VALUE,
      "Content-Security-Policy": "upgrade-insecure-requests",
    });
    assert.deepEqual(httpsResponseHeaders(view("enlightenedbeauty.grok.me", "http")), {});
    assert.deepEqual(httpsResponseHeaders(view("127.0.0.1:8080", "")), {});
  });
});

describe("viewFromHeaders / publicOriginFromRequest", () => {
  it("prefers forwarded host and proto", () => {
    const headers = new Headers({
      host: "127.0.0.1:8080",
      "x-forwarded-host": "enlightenedbeauty.grok.me",
      "x-forwarded-proto": "https, http",
    });
    const v = viewFromHeaders(headers, "http://127.0.0.1:8080/shop");
    assert.equal(v.host, "enlightenedbeauty.grok.me");
    assert.equal(v.forwardedProto, "https");
    assert.equal(v.path, "/shop");
    assert.equal(
      publicOriginFromRequest(new Request("http://127.0.0.1:8080/shop", { headers })),
      "https://enlightenedbeauty.grok.me",
    );
  });
});
