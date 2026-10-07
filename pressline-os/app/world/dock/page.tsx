import RoomFrame from "@/components/world/RoomFrame";
import { recentShipments } from "@/components/world/data";
import { trackingUrl } from "@/lib/shipping";

export const dynamic = "force-dynamic";

/** Loading Dock — recent shipments with tracking links. Order numbers only, no addresses. */
export default async function DockPage() {
  const shipments = await recentShipments(20);
  const when = (ts: string | null) => (ts ? new Date(ts).toLocaleDateString() : "—");
  return (
    <RoomFrame slug="dock" aside={<span className="text-mf-muted">{shipments.length} recent</span>}>
      {shipments.length === 0 ? (
        <p className="panel px-4 py-10 text-center text-sm text-mf-muted">Dock&rsquo;s clear. Nothing has shipped yet.</p>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-[.14em] text-mf-dim">
              <tr><th className="px-4 py-2">Order</th><th className="px-4 py-2">Carrier</th><th className="px-4 py-2">Tracking</th><th className="px-4 py-2">Shipped</th><th className="px-4 py-2">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-mf-line">
              {shipments.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 font-mono">{s.orderNumber ? `#${s.orderNumber}` : "—"}</td>
                  <td className="px-4 py-2 uppercase text-mf-muted">{s.carrier ?? "—"}</td>
                  <td className="px-4 py-2 font-mono">
                    {s.tracking ? <a href={trackingUrl(s.carrier ?? "", s.tracking)} target="_blank" rel="noopener noreferrer">{s.tracking}</a> : "—"}
                  </td>
                  <td className="px-4 py-2 text-mf-muted">{when(s.shipped_at)}</td>
                  <td className="px-4 py-2">
                    {s.delivered_at
                      ? <span className="badge" style={{ background: "#111111", color: "#ffffff" }}>Delivered {when(s.delivered_at)}</span>
                      : <span className="badge" style={{ background: "#0891b2", color: "#ffffff" }}>In transit</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </RoomFrame>
  );
}
