import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import { parseVagaroSheet } from "./vagaro-import.ts";

describe("parseVagaroSheet", () => {
  it("reads the sample Vagaro CSV, including quoted last-first names", async () => {
    const csv = await readFile(new URL("../../public/samples/vagaro-customers.csv", import.meta.url), "utf8");
    const result = await parseVagaroSheet(csv);
    assert.equal(result.skipped.length, 1);
    assert.equal(result.skipped[0]?.reason, "Missing name");
    const names = result.rows.map((r) => r.name);
    assert.deepEqual(names, [
      "Elena Voss",
      "Priya Shah",
      "Chris Nolan",
      "Jordan Hale",
      "Sasha Quill",
      "Avery Lane",
      "Dana Kim",
    ]);
    const elena = result.rows[0];
    assert.equal(elena?.email, "elena.voss@example.com");
    assert.equal(elena?.loyaltyPoints, 420);
    assert.match(elena?.phone ?? "", /920/);
  });

  it("reads an .xlsx workbook written by ExcelJS", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Customers");
    sheet.addRow(["Name", "Email", "Mobile", "Points Earned"]);
    sheet.addRow(["Marcus Chen", "marcus@example.com", "7155550101", 12]);
    const buffer = await workbook.xlsx.writeBuffer();
    const result = await parseVagaroSheet(buffer);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0]?.name, "Marcus Chen");
    assert.equal(result.rows[0]?.email, "marcus@example.com");
    assert.equal(result.rows[0]?.loyaltyPoints, 12);
  });

  it("reads ExcelJS rich text and numeric points", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Customers");
    sheet.addRow(["First Name", "Last Name", "Email", "Mobile", "Points Earned"]);
    const row = sheet.addRow(["", "", "nia@example.com", "7155550199", 8]);
    row.getCell(1).value = { richText: [{ text: "Nia" }] };
    row.getCell(2).value = { richText: [{ text: "Brooks" }] };
    const buffer = await workbook.xlsx.writeBuffer();
    const result = await parseVagaroSheet(buffer);
    assert.equal(result.rows[0]?.name, "Nia Brooks");
    assert.equal(result.rows[0]?.loyaltyPoints, 8);
  });

  it("skips classic OLE .xls with a Vagaro export hint", async () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    const result = await parseVagaroSheet(ole.buffer);
    assert.equal(result.rows.length, 0);
    assert.match(result.skipped[0]?.reason ?? "", /xlsx or CSV/i);
  });
});
