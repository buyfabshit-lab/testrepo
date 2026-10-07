import type { Metadata } from "next";
import { CONSENT_TEXT } from "@/lib/sms";
import { JoinForm } from "@/components/studio/JoinForm";

export const metadata: Metadata = { title: "Join" };

/** Front Gate — lead capture + consent (spec §8). The consent text comes from lib/sms so it's identical everywhere. */
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  const sp = await searchParams;
  return (
    <section className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-xs uppercase tracking-[.3em] text-mf-muted">Front Gate</p>
      <h1 className="mt-2 text-4xl text-mf-gold">Tell Outlaw what you&apos;re making</h1>
      <p className="mt-3 text-sm text-mf-muted">
        Moto, surf, skate, bars, gyms, teams, bands. Give us the shape of the job and we&apos;ll come back with a real number.
      </p>
      <div className="panel mt-8 p-5 sm:p-7">
        <JoinForm consentText={CONSENT_TEXT} referrer={sp.source ?? null} />
      </div>
    </section>
  );
}
