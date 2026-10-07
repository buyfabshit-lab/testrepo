import Link from "next/link";
import RoomFrame from "@/components/world/RoomFrame";

/** Front Gate / Bar — intake. The join form lives at /join; we send people there with the source tag. */
export default function GatePage() {
  return (
    <RoomFrame slug="gate">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="panel p-5">
          <p className="border-l-2 border-mf-gold pl-3 text-sm text-mf-muted">
            <span className="mr-2 text-[10px] uppercase tracking-[.14em] text-mf-dim">Outlaw</span>
            &ldquo;Evening. You&rsquo;re at the gate. Name and a way to reach you gets you a stool at the bar and a quote by morning. No name, no stool.&rdquo;
          </p>
          <h2 className="mt-6 text-2xl text-mf-gold">Sign in at the bar</h2>
          <p className="mt-2 text-sm text-mf-muted">Name, email, phone if you want texts (you say yes, we don&rsquo;t guess). Tagged <code className="font-mono text-mf-cream">source=front_gate</code> so we know you came through the clubhouse.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/join?source=front_gate" className="btn btn-solid">Sign in at the gate</Link>
            <Link href="/design?source=front_gate" className="btn">Skip to the studio</Link>
          </div>
        </div>
        <div className="panel overflow-hidden">
          <p className="border-b border-mf-line px-4 py-2 text-[10px] uppercase tracking-[.2em] text-mf-dim">Compact join form</p>
          <iframe src="/join?source=front_gate" title="Join form" className="h-[560px] w-full bg-mf-bg" loading="lazy" />
        </div>
      </div>
    </RoomFrame>
  );
}
