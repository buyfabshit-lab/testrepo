const cache = new Map<string, Promise<HTMLImageElement>>();

/** Load (and memoize) an image usable for canvas drawing. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  let p = cache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      if (!src.startsWith("data:") && !src.startsWith("blob:")) img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image failed to load"));
      img.src = src;
    });
    cache.set(src, p);
    p.catch(() => cache.delete(src));
  }
  return p;
}

export function svgToImage(svg: string): Promise<HTMLImageElement> {
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return loadImage(url);
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/**
 * Downscale very large uploads so the editor stays responsive. Anything up to
 * 4800 px on the long side (16 in at 300 DPI) is kept as-is.
 */
export async function normalizeUpload(file: File, maxSide = 4800): Promise<{ src: string; w: number; h: number }> {
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const { naturalWidth: w, naturalHeight: h } = img;
  if (Math.max(w, h) <= maxSide) return { src: dataUrl, w, h };
  const k = maxSide / Math.max(w, h);
  const c = document.createElement("canvas");
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return { src: c.toDataURL("image/png"), w: c.width, h: c.height };
}
