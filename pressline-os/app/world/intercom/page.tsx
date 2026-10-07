import RoomFrame from "@/components/world/RoomFrame";
import IntercomFeed from "@/components/world/IntercomFeed";
import { outlawEvents } from "@/components/world/data";

export const dynamic = "force-dynamic";

/** Intercom — Outlaw's last 20 lines (events where actor = 'outlaw'), refreshed every 30s, plus "ask Outlaw". */
export default async function IntercomPage() {
  const events = await outlawEvents(20);
  const initial = events.map((e) => ({ id: String(e.id), msg: e.msg, kind: e.kind, ts: e.ts, orderId: e.order_id }));
  return (
    <RoomFrame slug="intercom">
      <IntercomFeed initial={initial} />
    </RoomFrame>
  );
}
