import { useEffect, useState } from "react";

// Where the design files live in the repo. The page lists this folder through
// the GitHub contents API and links each file from this same site, so the
// repo doubles as the backup copy.
const OWNER = "buyfabshit-lab";
const REPO = "testrepo";
const BRANCH = "claude/seedance-railway-deploy-lcldsa";
const FOLDER = "web/public/vault/files";

export const UPLOAD_URL = `https://github.com/${OWNER}/${REPO}/upload/${BRANCH}/${FOLDER}`;
const BROWSE_URL = `https://github.com/${OWNER}/${REPO}/tree/${BRANCH}/${FOLDER}`;
/** Built by scripts/zip-designs.mjs on every deploy. */
const ZIP_URL = "/vault/all-designs.zip";

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"]);

type DesignFile = { name: string; path: string; size: number };
type Entry = { type: string; name: string; path: string; size: number };

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > -1 ? name.slice(i + 1).toLowerCase() : "";
}

/** Same-origin link to the file; lets the download attribute force a save. */
function hrefFor(f: DesignFile): string {
  const rel = f.path.slice(FOLDER.length + 1);
  return `/vault/files/${rel.split("/").map(encodeURIComponent).join("/")}`;
}

async function listFolder(path: string): Promise<DesignFile[]> {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`,
    { headers: { Accept: "application/vnd.github+json" } },
  );
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const items = (await res.json()) as Entry[];
  const out: DesignFile[] = [];
  for (const it of items) {
    if (it.type === "dir") out.push(...(await listFolder(it.path)));
    else if (it.type === "file" && !it.name.startsWith(".") && it.name.toLowerCase() !== "readme.md")
      out.push({ name: it.name, path: it.path, size: it.size });
  }
  return out;
}

export function Designs() {
  const [files, setFiles] = useState<DesignFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listFolder(FOLDER)
      .then((list) => {
        if (!alive) return;
        setFiles(list.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true })));
      })
      .catch((err: Error) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-3xl glass p-6 text-sm text-ash">
        Couldn't load the list ({error}). You can still grab them straight from the{" "}
        <a href={BROWSE_URL} className="text-hot-400 underline" target="_blank" rel="noreferrer noopener">
          repo folder
        </a>
        .
      </div>
    );
  }

  if (files === null) {
    return <div className="rounded-3xl glass p-6 text-sm text-ash">Loading designs...</div>;
  }

  if (!files.length) {
    return (
      <div className="rounded-3xl glass p-6 text-sm text-ash">
        Nothing dropped yet. Check back.
      </div>
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ash">
          {files.length} {files.length === 1 ? "design" : "designs"} &middot; tap one to download it
        </p>
        <a
          href={ZIP_URL}
          download="rollin-free-tv-designs.zip"
          className="rounded-full bg-hot-500 px-5 py-2.5 text-sm font-semibold text-white transition-transform glow-hot hover:scale-[1.03]"
        >
          Download all (.zip)
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
        {files.map((f) => {
          const ext = extOf(f.name);
          const href = hrefFor(f);
          return (
            <a
              key={f.path}
              href={href}
              download={f.name}
              title={`Download ${f.name}`}
              className="group flex flex-col overflow-hidden rounded-3xl glass transition-transform duration-300 hover:-translate-y-1"
            >
              <div
                className="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-black"
              >
                {IMAGE_EXT.has(ext) ? (
                  <img
                    src={href}
                    alt={f.name}
                    loading="lazy"
                    className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <span className="font-display text-3xl font-extrabold tracking-widest text-bone/30">
                    .{ext.toUpperCase() || "FILE"}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-3 p-3 sm:p-5">
                <div>
                  <h3 className="break-words font-display text-sm font-bold leading-tight text-bone sm:text-lg">
                    {f.name}
                  </h3>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ash sm:text-[11px]">
                    {fmtSize(f.size)}
                  </p>
                </div>
                <span className="mt-auto rounded-full bg-hot-500 px-4 py-2 text-center text-xs font-semibold text-white transition-transform glow-hot group-hover:scale-[1.02] sm:px-5 sm:py-2.5 sm:text-sm">
                  Download
                </span>
              </div>
            </a>
          );
        })}
      </div>

    </>
  );
}
