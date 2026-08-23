import { useEffect, useState } from "react";
import { isConfigured, supabase } from "../lib/supabase";
import type { ScheduleItem } from "../lib/types";

/** Upcoming streams, plus anything that started within the last 6 hours. */
export function useSchedule() {
  const [items, setItems] = useState<ScheduleItem[]>([]);

  useEffect(() => {
    if (!isConfigured) return;
    let alive = true;

    void (async () => {
      const since = new Date(Date.now() - 6 * 3600_000).toISOString();
      const { data } = await supabase
        .from("dime_schedule")
        .select("*")
        .gte("starts_at", since)
        .order("starts_at", { ascending: true })
        .limit(8);
      if (alive && data) setItems(data);
    })();

    return () => {
      alive = false;
    };
  }, []);

  return items;
}
