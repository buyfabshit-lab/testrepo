import { redirect } from "next/navigation";
import Link from "next/link";
import { currentStaff } from "@/lib/auth/staff";
import { serverClient } from "@/lib/supabase/server";
import { Nav } from "@/components/board/Nav";
import { OutlawChat } from "@/components/board/OutlawChat";
import { signOut } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const staff = await currentStaff();
  if (!staff) {
    // Signed in but not in pressline.staff → tell them, do not bounce in a loop.
    const { data: { user } } = await (await serverClient()).auth.getUser();
    redirect(user ? "/login?reason=notstaff" : "/login?next=/app");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-mf-line bg-mf-bg/95 px-4 backdrop-blur">
        <Link href="/app/board" className="font-display text-2xl uppercase tracking-[.12em] text-mf-gold no-underline">PRESSLINE</Link>
        <div className="flex items-center gap-3 text-xs">
          <div className="text-right leading-tight">
            <p className="font-bold text-mf-cream">{staff.name ?? staff.email ?? "Staff"}</p>
            <p className="uppercase tracking-widest text-mf-dim">{staff.role}</p>
          </div>
          <form action={signOut}>
            <button type="submit" className="btn !px-2.5 !py-1 !text-[.65rem]">Sign out</button>
          </form>
        </div>
      </header>

      <div className="flex flex-1">
        <Nav role={staff.role} />
        <main className="min-w-0 flex-1 px-4 pb-24 pt-4 md:pb-8">{children}</main>
      </div>

      <OutlawChat staffName={staff.name ?? "staff"} />
    </div>
  );
}
