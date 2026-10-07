"use server";
import { revalidatePath } from "next/cache";
import { requireStaff, type StaffRole } from "@/lib/auth/staff";
import { db } from "@/lib/supabase/service";

const ROLES: StaffRole[] = ["owner", "production", "print", "ship"];

/** Owner only. You cannot demote yourself (someone has to hold the keys). */
export async function updateStaffRole(form: FormData): Promise<void> {
  const me = await requireStaff(["owner"]);
  const id = String(form.get("id") ?? "");
  const role = String(form.get("role") ?? "") as StaffRole;
  if (!id || !ROLES.includes(role)) return;
  if (id === me.userId && role !== "owner") return;
  await db().from("staff").update({ role }).eq("id", id);
  revalidatePath("/app/settings");
}
