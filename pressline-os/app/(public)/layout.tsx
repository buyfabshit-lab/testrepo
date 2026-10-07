import { Suspense } from "react";
import { PublicChrome } from "@/components/studio/PublicChrome";

/** Minimal customer-facing shell: wordmark up top, the line down below. Chrome drops out for `?mode=arcade`. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Suspense fallback={null}><PublicChrome slot="header" /></Suspense>
      <main className="flex-1">{children}</main>
      <Suspense fallback={null}><PublicChrome slot="footer" /></Suspense>
    </div>
  );
}
