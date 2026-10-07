import { describe, expect, it } from "vitest";
import { brandCode, printFileName, sheetFileName, yyyymmdd } from "@/lib/naming";

describe("file naming", () => {
  const d = new Date("2026-10-07T20:00:00Z"); // 13:00 Pacific on Oct 7
  it("builds {ORDER}-{BRAND}-{SKU}-{LOC}-{YYYYMMDD}.png", () => {
    expect(printFileName({ orderNumber: 1042, brand: "death_corps", blankStyle: "5000", blankBrand: "Gildan", location: "front", date: d })).toBe("1042-DC-G5000-FRONT-20261007.png");
  });
  it("falls back sanely", () => {
    expect(printFileName({ orderNumber: null, date: d })).toBe("DRAFT-CU-NA-FRONT-20261007.png");
    expect(brandCode("Skrew U")).toBe("SU");
    expect(brandCode("valhalla")).toBe("VM");
  });
  it("uses the Pacific calendar date", () => {
    expect(yyyymmdd(new Date("2026-10-08T05:30:00Z"))).toBe("20261007");
  });
  it("names gang sheets per run", () => {
    expect(sheetFileName("2026-10-07", 2)).toBe("PL-20261007-2.png");
  });
});
