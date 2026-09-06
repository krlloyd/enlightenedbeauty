import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isStudioLocked, lockStudioSession, unlockStudioSession } from "./studio-lock.ts";

describe("studio desk lock", () => {
  const mem = new Map<string, string>();
  const store = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: (k: string) => {
      mem.delete(k);
    },
  };
  Object.defineProperty(globalThis, "sessionStorage", { value: store, configurable: true });

  let cookie = "";
  Object.defineProperty(globalThis, "document", {
    value: {
      get cookie() {
        return cookie;
      },
      set cookie(v: string) {
        if (v.includes("Max-Age=0")) cookie = "";
        else cookie = v.split(";")[0];
      },
    },
    configurable: true,
  });

  it("locks and unlocks the desk independently of the auth session", () => {
    unlockStudioSession();
    assert.equal(isStudioLocked(), false);
    lockStudioSession();
    assert.equal(isStudioLocked(), true);
    assert.equal(cookie.includes("eb-studio-lock=1"), true);
    unlockStudioSession();
    assert.equal(isStudioLocked(), false);
    assert.equal(cookie.includes("eb-studio-lock=1"), false);
  });

  it("still reports locked when only the cookie remains", () => {
    unlockStudioSession();
    mem.clear();
    cookie = "eb-studio-lock=1";
    assert.equal(isStudioLocked(), true);
    unlockStudioSession();
    assert.equal(isStudioLocked(), false);
  });
});
