import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SEED_CLIENTS, SEED_GIFT_CODE, WEEK_HOURS } from "./catalog.ts";
import {
  backupIsDue,
  parseBackupCadence,
  pickSalonPayload,
  stripDemoRecords,
  type SalonPayload,
} from "./salon-payload.ts";

function emptyPayload(over: Partial<SalonPayload> = {}): SalonPayload {
  return {
    appointments: [],
    clients: [],
    products: [],
    sales: [],
    giftCards: [],
    staff: [{ id: "elena", name: "Elena", role: "Owner", bio: "", initials: "EV", specialties: ["color"], chip: "appt-elena", startHour: 9, endHour: 18 }],
    services: [],
    hours: WEEK_HOURS,
    depositMin: 75,
    affirmEnabled: true,
    affirmMin: 50,
    ...over,
  };
}

describe("salon payload", () => {
  it("defaults unknown cadence to daily", () => {
    assert.equal(parseBackupCadence("weekly"), "weekly");
    assert.equal(parseBackupCadence("nope"), "daily");
  });

  it("is due when nothing has been saved yet, and respects the span", () => {
    assert.equal(backupIsDue(null, "daily"), true);
    assert.equal(backupIsDue(null, "off"), false);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    assert.equal(backupIsDue(hourAgo, "daily"), false);
    const twoDays = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    assert.equal(backupIsDue(twoDays, "daily"), true);
    assert.equal(backupIsDue(twoDays, "weekly"), false);
  });

  it("strips sample clients, visits, tickets, and the demo gift card", () => {
    const jordan = SEED_CLIENTS[0];
    const real = {
      id: "real-1",
      name: "Pat Real",
      phone: "(715) 330-5000",
      email: "pat@mail.test",
      notes: "",
      loyaltyPoints: 0,
      createdAt: "2026-09-01T12:00:00.000Z",
    };
    const next = stripDemoRecords(
      emptyPayload({
        clients: [jordan, real],
        appointments: [
          {
            id: "a1",
            clientId: jordan.id,
            staffId: "elena",
            serviceId: "cut",
            start: "2026-09-06T14:00:00.000Z",
            durationMin: 45,
            status: "booked",
            notes: "",
            depositPaid: false,
            createdAt: "2026-09-01T12:00:00.000Z",
          },
          {
            id: "live-appt",
            clientId: real.id,
            staffId: "elena",
            serviceId: "cut",
            start: "2026-09-08T14:00:00.000Z",
            durationMin: 45,
            status: "booked",
            notes: "",
            depositPaid: false,
            createdAt: "2026-09-01T12:00:00.000Z",
          },
        ],
        giftCards: [
          {
            id: "g1",
            code: SEED_GIFT_CODE,
            balance: 75,
            original: 75,
            from: "Jordan Hale",
            to: "Kate Hale",
            createdAt: "2026-08-01T12:00:00.000Z",
          },
        ],
        sales: [
          {
            id: "s1",
            at: "2026-09-01T12:00:00.000Z",
            clientId: jordan.id,
            items: [],
            subtotal: 10,
            tax: 0,
            tip: 0,
            total: 10,
            method: "card",
          },
        ],
      }),
    );
    assert.deepEqual(
      next.clients.map((c) => c.id),
      ["real-1"],
    );
    assert.deepEqual(
      next.appointments.map((a) => a.id),
      ["live-appt"],
    );
    assert.equal(next.giftCards.length, 0);
    assert.equal(next.sales.length, 0);
  });

  it("rejects a payload with no team as empty", () => {
    assert.equal(pickSalonPayload({ appointments: [] }), null);
  });
});
