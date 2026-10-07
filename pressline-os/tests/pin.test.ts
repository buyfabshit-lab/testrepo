import { describe, expect, it } from "vitest";
import { hashPin, pinMatches, issueOfficeToken, verifyOfficeToken } from "@/lib/auth/pin";

describe("office PIN", () => {
  it("hashes and verifies a PIN with scrypt", () => {
    const h = hashPin("4821");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(pinMatches("4821", h)).toBe(true);
    expect(pinMatches("4822", h)).toBe(false);
    expect(pinMatches("4821", "garbage")).toBe(false);
  });
  it("issues and verifies an HMAC office token", () => {
    process.env.APP_SIGNING_SECRET = "s3cret";
    const t = issueOfficeToken(1_000_000);
    expect(verifyOfficeToken(t, 1_000_100)).toBe(true);
    expect(verifyOfficeToken(t, 1_000_000 + 9 * 3600)).toBe(false);
    expect(verifyOfficeToken(t + "x", 1_000_100)).toBe(false);
  });
});
