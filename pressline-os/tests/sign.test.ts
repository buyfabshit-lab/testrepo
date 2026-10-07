import { describe, expect, it } from "vitest";
import { sign, verify } from "@/lib/n8n/sign";

describe("n8n HMAC", () => {
  const secret = "test-secret";
  it("round-trips", () => {
    const body = JSON.stringify({ a: 1 });
    const h = sign(body, secret, 1_000_000);
    expect(verify(body, h, secret, 1_000_010)).toBe(true);
  });
  it("rejects tampered bodies, wrong secrets, stale timestamps, and missing headers", () => {
    const body = JSON.stringify({ a: 1 });
    const h = sign(body, secret, 1_000_000);
    expect(verify(JSON.stringify({ a: 2 }), h, secret, 1_000_010)).toBe(false);
    expect(verify(body, h, "other", 1_000_010)).toBe(false);
    expect(verify(body, h, secret, 1_000_000 + 301)).toBe(false);
    expect(verify(body, null, secret)).toBe(false);
    expect(verify(body, h, "", 1_000_010)).toBe(false);
  });
});
