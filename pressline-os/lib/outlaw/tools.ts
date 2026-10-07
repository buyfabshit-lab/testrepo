import "server-only";
import { db } from "@/lib/supabase/service";
import { pacificDate } from "@/lib/naming";

/**
 * Outlaw's DB tools. Read-only. These are the ONLY facts Outlaw may speak.
 */
export const OUTLAW_TOOLS = [
  {
    name: "get_order",
    description: "Look up one order by its number (e.g. 1042) or UUID. Returns status, due date, customer, lines, recent events, shipment.",
    input_schema: { type: "object", properties: { number: { type: "integer" }, id: { type: "string" } } },
  },
  {
    name: "list_orders",
    description: "List orders, optionally filtered by status (NEW…DONE, HOLD) or due before a date. Returns up to 50.",
    input_schema: { type: "object", properties: { status: { type: "string" }, due_before: { type: "string" }, limit: { type: "integer" } } },
  },
  {
    name: "whats_on_hold",
    description: "All orders currently in HOLD with the reason from the log.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "last_gang_run",
    description: "The most recent nightly gang run: date, sheet count, designs, report text.",
    input_schema: { type: "object", properties: { run_date: { type: "string", description: "YYYY-MM-DD; default latest" } } },
  },
  {
    name: "recent_events",
    description: "Recent log entries, optionally for one order. Newest first, up to 30.",
    input_schema: { type: "object", properties: { order_number: { type: "integer" }, limit: { type: "integer" } } },
  },
  {
    name: "todays_board",
    description: "Counts of orders per status plus anything due today or overdue.",
    input_schema: { type: "object", properties: {} },
  },
] as const;

export type ToolName = (typeof OUTLAW_TOOLS)[number]["name"];

export async function runTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name as ToolName) {
    case "get_order": {
      let q = db().from("orders").select("id, number, status, due_date, rush, created_at, customer:customers(name, company), lines:order_lines(sizes, locations, unit_price, blank:blanks(style, brand, color), design:designs(file_name, method)), shipments(carrier, tracking, shipped_at)");
      if (typeof input.number === "number") q = q.eq("number", input.number);
      else if (typeof input.id === "string") q = q.eq("id", input.id);
      else return { error: "need number or id" };
      const { data } = await q.maybeSingle();
      if (!data) return { found: false };
      const { data: events } = await db().from("events").select("actor, kind, msg, ts").eq("order_id", data.id).order("ts", { ascending: false }).limit(8);
      return { found: true, order: data, events: events ?? [] };
    }
    case "list_orders": {
      let q = db().from("orders").select("number, status, due_date, rush, customer:customers(name, company)").order("due_date", { ascending: true, nullsFirst: false }).limit(Math.min(50, Number(input.limit) || 50));
      if (typeof input.status === "string") q = q.eq("status", input.status.toUpperCase() as never);
      if (typeof input.due_before === "string") q = q.lte("due_date", input.due_before);
      const { data } = await q;
      return { orders: data ?? [] };
    }
    case "whats_on_hold": {
      const { data } = await db().from("orders").select("id, number, due_date, customer:customers(name, company)").eq("status", "HOLD");
      const out = [];
      for (const o of data ?? []) {
        const { data: ev } = await db().from("events").select("msg, ts").eq("order_id", o.id).eq("kind", "status").order("ts", { ascending: false }).limit(1);
        out.push({ number: o.number, due_date: o.due_date, customer: o.customer, reason: ev?.[0]?.msg ?? "no reason logged" });
      }
      return { on_hold: out };
    }
    case "last_gang_run": {
      let q = db().from("gang_runs").select("run_date, sheet_files, design_ids, sent_to_danny_at, report").order("run_date", { ascending: false }).limit(1);
      if (typeof input.run_date === "string") q = db().from("gang_runs").select("run_date, sheet_files, design_ids, sent_to_danny_at, report").eq("run_date", input.run_date).limit(1);
      const { data } = await q;
      const run = data?.[0];
      return run ? { found: true, run: { ...run, sheets: run.sheet_files?.length ?? 0, designs: run.design_ids?.length ?? 0 } } : { found: false, today: pacificDate() };
    }
    case "recent_events": {
      let q = db().from("events").select("order_id, actor, kind, msg, ts").order("ts", { ascending: false }).limit(Math.min(30, Number(input.limit) || 20));
      if (typeof input.order_number === "number") {
        const { data: o } = await db().from("orders").select("id").eq("number", input.order_number).maybeSingle();
        if (!o) return { events: [], note: "no such order" };
        q = q.eq("order_id", o.id);
      }
      const { data } = await q;
      return { events: data ?? [] };
    }
    case "todays_board": {
      const { data } = await db().from("orders").select("number, status, due_date, rush");
      const today = pacificDate();
      const counts: Record<string, number> = {};
      const dueToday: number[] = [], overdue: number[] = [];
      for (const o of data ?? []) {
        counts[o.status ?? "?"] = (counts[o.status ?? "?"] ?? 0) + 1;
        if (o.due_date && !["DONE", "SHIPPED", "CANCELLED"].includes(o.status ?? "")) {
          if (o.due_date === today) dueToday.push(o.number);
          else if (o.due_date < today) overdue.push(o.number);
        }
      }
      return { today, counts, due_today: dueToday, overdue };
    }
    default:
      return { error: `unknown tool ${name}` };
  }
}
