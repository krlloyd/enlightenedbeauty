import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { can, isStudioRole, parseStudioRole, permissionForPath } from "./roles.ts";

describe("studio roles", () => {
  it("gives the owner every desk page", () => {
    for (const perm of [
      "today",
      "calendar",
      "clients",
      "menu",
      "pos",
      "payments",
      "inventory",
      "hours",
      "reports",
      "access",
      "reset",
    ] as const) {
      assert.equal(can("owner", perm), true);
    }
  });

  it("keeps payments and access on the owner only", () => {
    assert.equal(can("manager", "payments"), false);
    assert.equal(can("manager", "access"), false);
    assert.equal(can("manager", "reports"), true);
    assert.equal(can("desk", "pos"), true);
    assert.equal(can("desk", "menu"), false);
    assert.equal(can("specialist", "clients"), false);
    assert.equal(can("specialist", "calendar"), true);
    assert.equal(can(null, "today"), false);
  });

  it("maps studio paths to the tightest permission", () => {
    assert.equal(permissionForPath("/studio"), "today");
    assert.equal(permissionForPath("/studio/"), "today");
    assert.equal(permissionForPath("/studio/calendar"), "calendar");
    assert.equal(permissionForPath("/studio/clients"), "clients");
    assert.equal(permissionForPath("/studio/menu"), "menu");
    assert.equal(permissionForPath("/studio/pos"), "pos");
    assert.equal(permissionForPath("/studio/payments"), "payments");
    assert.equal(permissionForPath("/studio/inventory"), "inventory");
    assert.equal(permissionForPath("/studio/hours"), "hours");
    assert.equal(permissionForPath("/studio/reports"), "reports");
    assert.equal(permissionForPath("/studio/reports/hours"), "reports");
    assert.equal(permissionForPath("/studio/access"), "access");
  });

  it("rejects unknown role strings as specialist, not owner", () => {
    assert.equal(isStudioRole("owner"), true);
    assert.equal(isStudioRole("admin"), false);
    assert.equal(parseStudioRole("owner"), "owner");
    assert.equal(parseStudioRole("admin"), "specialist");
  });
});
