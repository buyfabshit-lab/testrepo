// Tag a PNG with physical pixel density (pHYs chunk) so Photoshop, Illustrator
// and print shops read the file as 300 DPI instead of the default 72.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export async function withDpi(blob: Blob, dpi: number): Promise<Blob> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  // Signature (8) + IHDR chunk (4 len + 4 type + 13 data + 4 crc) = 33 bytes.
  const ihdrEnd = 33;
  const ppm = Math.round(dpi / 0.0254);
  const data = new Uint8Array(9);
  const dv = new DataView(data.buffer);
  dv.setUint32(0, ppm);
  dv.setUint32(4, ppm);
  data[8] = 1; // unit: metre
  const typeAndData = new Uint8Array(4 + 9);
  typeAndData.set([0x70, 0x48, 0x59, 0x73], 0); // "pHYs"
  typeAndData.set(data, 4);
  const chunk = new Uint8Array(4 + 13 + 4);
  new DataView(chunk.buffer).setUint32(0, 9);
  chunk.set(typeAndData, 4);
  new DataView(chunk.buffer).setUint32(17, crc32(typeAndData));
  // Strip any existing pHYs chunk so we don't emit two.
  let rest = buf.subarray(ihdrEnd);
  const existing = findChunk(rest, "pHYs");
  if (existing) rest = concat(rest.subarray(0, existing.start), rest.subarray(existing.end));
  const out = concat(buf.subarray(0, ihdrEnd), chunk, rest);
  return new Blob([out], { type: "image/png" });
}

function findChunk(bytes: Uint8Array, type: string): { start: number; end: number } | null {
  let i = 0;
  while (i + 8 <= bytes.length) {
    const len = new DataView(bytes.buffer, bytes.byteOffset + i).getUint32(0);
    const t = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
    const end = i + 12 + len;
    if (t === type) return { start: i, end };
    if (t === "IEND") break;
    i = end;
  }
  return null;
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(new ArrayBuffer(total));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
  );
}
