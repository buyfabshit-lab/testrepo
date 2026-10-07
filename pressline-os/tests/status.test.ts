import { describe, expect, it } from "vitest";
import { BOARD_LANES, ORDER_STATUSES, STATUS_COLORS, audienceFor, canTransition } from "@/lib/orders/status";

describe("order state machine", () => {
  it("follows the spec path", () => {
    const path = ["NEW", "QUOTED", "APPROVED", "PAID", "BLANKS_ORDERED", "ART_READY", "ON_GANG_SHEET", "PRINTED", "PACKED", "SHIPPED", "DONE"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });
  it("blocks skipping without force, allows with force", () => {
    expect(canTransition("NEW", "PAID")).toBe(false);
    expect(canTransition("NEW", "PAID", { force: true })).toBe(true);
    expect(canTransition("DONE", "NEW", { force: true })).toBe(true);
    expect(canTransition("PAID", "PAID", { force: true })).toBe(false);
  });
  it("HOLD is reachable before shipping and releasable", () => {
    expect(canTransition("ART_READY", "HOLD")).toBe(true);
    expect(canTransition("SHIPPED", "HOLD")).toBe(false);
    expect(canTransition("HOLD", "ART_READY")).toBe(true);
  });
  it("has a color for every status and a lane order", () => {
    for (const s of ORDER_STATUSES) expect(STATUS_COLORS[s].hex).toMatch(/^#/);
    expect(BOARD_LANES[0]).toBe("NEW");
    expect(STATUS_COLORS.HOLD.name).toBe("red");
    expect(STATUS_COLORS.DONE.name).toBe("black");
  });
  it("pings the right people", () => {
    expect(audienceFor("ART_READY")).toEqual(["danny"]);
    expect(audienceFor("HOLD")).toEqual(["justin"]);
    expect(audienceFor("SHIPPED")).toContain("customer");
  });
});
