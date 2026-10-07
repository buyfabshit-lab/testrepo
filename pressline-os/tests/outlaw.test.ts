import { describe, expect, it } from "vitest";
import { classifyFile, pingFor } from "@/lib/outlaw";

describe("outlaw", () => {
  it("classifies intake files into FUSION INTAKE folders", () => {
    expect(classifyFile("logo.ai").cls).toBe("Vectors");
    expect(classifyFile("skull.psd").cls).toBe("Art Files");
    expect(classifyFile("front.png").cls).toBe("Artwork");
    expect(classifyFile("MidnightType.otf").cls).toBe("Fonts");
    expect(classifyFile("sizes.xlsx").cls).toBe("Customer Files");
    expect(classifyFile("notes.txt").cls).toBe("Client Requests");
    expect(classifyFile("mystery.bin").cls).toBe("Incoming");
  });
  it("pings only with facts it was given", () => {
    const p = pingFor("ART_READY", 1042);
    expect(p[0].to).toBe("danny");
    expect(p[0].text).toContain("1042");
    expect(pingFor("DONE", 1)).toEqual([]);
  });
});
