import Link from "next/link";
import RoomFrame from "@/components/world/RoomFrame";
import { blankCounts, lastGangRun } from "@/components/world/data";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Supplier Row — five storefronts, one status line each. Wired/not-wired only; never the keys. */
export default async function DistrictPage() {
  const [blanks, run] = await Promise.all([blankCounts(), lastGangRun()]);
  const n = (k: string) => blanks[k] ?? 0;
  const shops: Array<{ name: string; sign: string; status: string; ok: boolean }> = [
    { name: "S&S Activewear", sign: "BLANKS · LIVE API", ok: Boolean(env.ssApiKey()), status: env.ssApiKey() ? `Live. ${n("ss")} cached style${n("ss") === 1 ? "" : "s"}.` : `Not wired. ${n("ss")} cached style${n("ss") === 1 ? "" : "s"}.` },
    { name: "SanMar", sign: "BLANKS · DATA FEED", ok: Boolean(env.sanmarDataUrl()), status: env.sanmarDataUrl() ? `Feed set. ${n("sanmar")} style${n("sanmar") === 1 ? "" : "s"}.` : `Feed not set. ${n("sanmar")} style${n("sanmar") === 1 ? "" : "s"}.` },
    { name: "Unity", sign: "BLANKS · MANUAL", ok: n("unity") > 0, status: `${n("unity")} style${n("unity") === 1 ? "" : "s"} on file. Ordered by hand.` },
    { name: "Danny", sign: "PRINT PARTNER", ok: Boolean(run?.sent_to_danny_at), status: run ? (run.sent_to_danny_at ? `Last sheet sent ${new Date(run.sent_to_danny_at).toLocaleDateString()}.` : "Run built, not sent yet.") : "No gang run yet." },
    { name: "Oceanaire", sign: "EMBROIDERY", ok: false, status: "Quoted by hand. No feed." },
  ];
  return (
    <RoomFrame slug="district" aside={<Link href="/app/suppliers" className="btn">Open suppliers</Link>}>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {shops.map((s) => (
          <li key={s.name} className="panel flex flex-col">
            <div className="border-b-4 border-mf-line bg-mf-bg px-3 py-2">
              <p className="text-[10px] uppercase tracking-[.2em] text-mf-dim">{s.sign}</p>
              <h2 className="text-xl text-mf-gold">{s.name}</h2>
            </div>
            <div className="flex flex-1 flex-col justify-between gap-3 p-3">
              <p className="text-sm text-mf-muted"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${s.ok ? "bg-[#16a34a]" : "bg-mf-dim"}`} aria-hidden />{s.status}</p>
              <Link href="/app/suppliers" className="text-xs uppercase tracking-[.14em]">Walk in →</Link>
            </div>
          </li>
        ))}
      </ul>
    </RoomFrame>
  );
}
