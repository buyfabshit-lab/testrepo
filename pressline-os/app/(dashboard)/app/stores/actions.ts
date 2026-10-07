"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/staff";
import { db } from "@/lib/supabase/service";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);

export type NewStoreState = { ok?: boolean; error?: string };

/** Owner only: create a pop-up store row. Products get added from the studio / publish flow. */
export async function createPopupStore(_prev: NewStoreState, form: FormData): Promise<NewStoreState> {
  try {
    await requireStaff(["owner"]);
  } catch {
    return { error: "Owner only" };
  }
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Name required" };
  const slug = slugify(String(form.get("slug") ?? "") || name);
  const pct = Number(form.get("fundraising_pct") ?? 0);
  const opens = String(form.get("opens_at") ?? "").trim();
  const closes = String(form.get("closes_at") ?? "").trim();
  const { error } = await db().from("stores").insert({
    name, slug, type: "popup",
    world_room: String(form.get("world_room") ?? "").trim() || null,
    opens_at: opens ? new Date(opens).toISOString() : null,
    closes_at: closes ? new Date(closes).toISOString() : null,
    fundraising_pct: Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0,
  });
  if (error) return { error: error.message };
  revalidatePath("/app/stores");
  return { ok: true };
}
