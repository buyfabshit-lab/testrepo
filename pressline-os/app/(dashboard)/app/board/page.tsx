import type { Metadata } from "next";
import { db } from "@/lib/supabase/service";
import { Board } from "@/components/board/Board";
import { BOARD_SELECT, type BoardOrder } from "@/components/board/types";
import { PageHeader } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Board" };
export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const { data, error } = await db()
    .from("orders")
    .select(BOARD_SELECT)
    .neq("status", "CANCELLED")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(500)
    .overrideTypes<BoardOrder[], { merge: false }>();

  return (
    <>
      <PageHeader title="Board" subtitle={error ? `Could not load orders: ${error.message}` : "Drag a card to move it. Phones: tap Move."} />
      <Board initial={data ?? []} />
    </>
  );
}
