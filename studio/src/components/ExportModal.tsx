import { useEffect, useState } from "react";
import { blankById } from "../engine/blanks";
import { downloadBlob, renderMockup, renderPrintFile, slug } from "../engine/render";
import { fontsSettled } from "../engine/text";
import { printPx, type Design } from "../engine/types";
import { IDownload, IX } from "./icons";

interface Props {
  design: Design;
  onClose: () => void;
  onError: (msg: string) => void;
}

interface Out { blob: Blob; url: string; width: number; height: number }

export function ExportModal({ design, onClose, onError }: Props) {
  const [backdrop, setBackdrop] = useState<"studio" | "transparent">("studio");
  const [print, setPrint] = useState<Out | null>(null);
  const [mock, setMock] = useState<Out | null>(null);
  const [busy, setBusy] = useState(true);
  const blank = blankById(design.blank);
  const area = printPx(blank);
  const base = `${slug(design.name)}-${design.blank}`;

  useEffect(() => {
    let alive = true;
    setBusy(true);
    (async () => {
      try {
        await fontsSettled();
        const [p, m] = await Promise.all([renderPrintFile(design), renderMockup(design, { size: 2000, backdrop })]);
        if (!alive) return;
        setPrint((old) => { if (old) URL.revokeObjectURL(old.url); return { blob: p.blob, url: URL.createObjectURL(p.blob), width: p.width, height: p.height }; });
        setMock((old) => { if (old) URL.revokeObjectURL(old.url); return { blob: m.blob, url: URL.createObjectURL(m.blob), width: m.width, height: m.height }; });
      } catch (e) {
        onError(e instanceof Error ? e.message : "Export failed");
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => { alive = false; };
  }, [design, backdrop, onError]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mb = (b: Blob) => `${(b.size / 1048576).toFixed(2)} MB`;

  return (
    <div className="modal-bg" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="glass rounded-3xl w-full max-w-4xl p-5 md:p-6 pop max-h-[92vh] overflow-auto">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="eyebrow">Export</div>
            <h2 className="text-xl font-bold mt-1">Two files, print-shop ready</h2>
            <p className="text-[12.5px] text-ink-300 mt-1">{design.name} · {blank.label} {blank.view} · {blank.printIn.w}×{blank.printIn.h} in</p>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><IX /></button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card
            title="Print file"
            subtitle={`${area.w} × ${area.h} px · 300 DPI · transparent PNG`}
            tone="violet"
            busy={busy}
            preview={print?.url}
            checker
            meta={print ? mb(print.blob) : ""}
            onDownload={() => print && downloadBlob(print.blob, `${base}-print-300dpi.png`)}
          />
          <Card
            title="Mockup"
            subtitle={`${mock?.width ?? 2000} × ${mock?.height ?? 2000} px · PNG`}
            tone="amber"
            busy={busy}
            preview={mock?.url}
            checker={backdrop === "transparent"}
            meta={mock ? mb(mock.blob) : ""}
            onDownload={() => mock && downloadBlob(mock.blob, `${base}-mockup.png`)}
            extra={
              <div className="seg">
                <button data-active={backdrop === "studio"} onClick={() => setBackdrop("studio")}>Studio</button>
                <button data-active={backdrop === "transparent"} onClick={() => setBackdrop("transparent")}>Transparent</button>
              </div>
            }
          />
        </div>

        <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11.5px] text-ink-300">The print file is tagged 300 DPI in its metadata, so it opens at true size in Photoshop, Illustrator and RIP software.</p>
          <button
            className="btn btn-primary"
            disabled={busy || !print || !mock}
            onClick={() => { if (print && mock) { downloadBlob(print.blob, `${base}-print-300dpi.png`); setTimeout(() => downloadBlob(mock.blob, `${base}-mockup.png`), 350); } }}
          >
            <IDownload /> Download both
          </button>
        </div>
      </div>
    </div>
  );
}

function Card({ title, subtitle, tone, busy, preview, checker, meta, onDownload, extra }: {
  title: string; subtitle: string; tone: "violet" | "amber"; busy: boolean; preview?: string; checker?: boolean; meta: string; onDownload: () => void; extra?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border hairline bg-black/30 p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-bold text-[14px]">{title}</div>
          <div className="text-[11.5px] text-ink-300">{subtitle}</div>
        </div>
        {extra}
      </div>
      <div className={`relative rounded-xl overflow-hidden aspect-square grid place-items-center ${checker ? "checker" : "bg-black/40"}`} style={{ boxShadow: tone === "violet" ? "inset 0 0 0 1px rgba(124,92,255,.35)" : "inset 0 0 0 1px rgba(245,165,36,.35)" }}>
        {preview && <img src={preview} alt={title} className="max-w-full max-h-full object-contain" style={{ opacity: busy ? 0.4 : 1, transition: "opacity .3s" }} />}
        {busy && <div className="absolute inset-0 grid place-items-center text-[12px] font-semibold tracking-widest uppercase text-ink-300"><span className="animate-pulse">Rendering…</span></div>}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-ink-300 tabular-nums">{meta}</span>
        <button className={`btn btn-sm ${tone === "violet" ? "btn-primary" : "btn-amber"}`} disabled={busy || !preview} onClick={onDownload}><IDownload /> Download</button>
      </div>
    </div>
  );
}
