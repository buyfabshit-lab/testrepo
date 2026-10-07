import type { OrderRow } from "@/lib/supabase/types";

/** Order as the board and lists load it: the row + a slim customer + line ids. */
export type BoardCustomer = { id: string; name: string | null; company: string | null; email?: string | null };
export type BoardOrder = OrderRow & { customer: BoardCustomer | null; lines: { id: string }[] | null };

export const BOARD_SELECT = "*, customer:customers(id,name,company), lines:order_lines(id)";
