import { describe, expect, it } from "vitest";
import { screen } from "@/lib/screen";

describe("intake screen", () => {
  it("passes a normal shop", () => {
    expect(screen({ name: "Raymond", email: "ray@unityclothing.com", company: "Unity Clothing", notes: "24 tees for the shop" }).result).toBe("pass");
  });
  it("holds on a blocklist hit and never rejects silently", () => {
    const r = screen({ name: "x", email: "x@y.com", notes: "put 1488 on the back" });
    expect(r.result).toBe("hold");
    expect(r.hits[0]).toMatchObject({ category: "hate", field: "notes" });
  });
  it("holds disposable emails", () => {
    expect(screen({ email: "a@mailinator.com" }).result).toBe("hold");
  });
  it("flags manus domains", () => {
    expect(screen({ website: "https://foo.manus.space" }).hits.some((h) => h.category === "domains")).toBe(true);
  });
});
