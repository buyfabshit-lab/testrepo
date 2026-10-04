import { ensureSession, supabase, UPLOAD_BUCKET } from "./supabase";
import { localStore } from "./localStore";
import type { Design, Layer } from "../engine/types";

export interface SavedDesign {
  id: string;
  name: string;
  blank: Design["blank"];
  color: string;
  layers: Layer[];
  thumbnail: string | null; // data URL (local) or public URL (cloud)
  updatedAt: string;
  source: "cloud" | "local";
}

export type StorageMode = "cloud" | "local";

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = /data:(.*?);/.exec(head)?.[1] ?? "application/octet-stream";
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function uploadBlob(userId: string, path: string, blob: Blob): Promise<string> {
  const { error } = await supabase!.storage.from(UPLOAD_BUCKET).upload(`${userId}/${path}`, blob, {
    upsert: true,
    contentType: blob.type || "application/octet-stream",
    cacheControl: "31536000",
  });
  if (error) throw error;
  return supabase!.storage.from(UPLOAD_BUCKET).getPublicUrl(`${userId}/${path}`).data.publicUrl;
}

/** Upload any inline (data:) images so the saved design references durable URLs. */
async function externalizeLayers(userId: string, designId: string, layers: Layer[]): Promise<Layer[]> {
  const out: Layer[] = [];
  for (const l of layers) {
    if (l.kind === "image" && l.src.startsWith("data:")) {
      const blob = dataUrlToBlob(l.src);
      const ext = blob.type.includes("png") ? "png" : blob.type.includes("svg") ? "svg" : blob.type.includes("webp") ? "webp" : "jpg";
      const url = await uploadBlob(userId, `${designId}/${l.id}.${ext}`, blob);
      out.push({ ...l, src: url });
    } else out.push(l);
  }
  return out;
}

export async function saveDesign(design: Design, thumbnail: Blob): Promise<{ saved: SavedDesign; mode: StorageMode; layers: Layer[] }> {
  const updatedAt = new Date().toISOString();
  if (supabase) {
    const userId = await ensureSession();
    if (userId) {
      const layers = await externalizeLayers(userId, design.id, design.layers);
      const thumbUrl = await uploadBlob(userId, `${design.id}/thumb.png`, thumbnail);
      const row = {
        id: design.id,
        owner: userId,
        name: design.name,
        blank: design.blank,
        color: design.color,
        layers,
        thumbnail_url: `${thumbUrl}?v=${Date.now()}`,
        updated_at: updatedAt,
      };
      const { error } = await supabase.from("studio_designs").upsert(row);
      if (error) throw error;
      return {
        saved: { id: design.id, name: design.name, blank: design.blank, color: design.color, layers, thumbnail: row.thumbnail_url, updatedAt, source: "cloud" },
        mode: "cloud",
        layers,
      };
    }
  }
  const thumbDataUrl = await blobToDataUrl(thumbnail);
  const saved: SavedDesign = { id: design.id, name: design.name, blank: design.blank, color: design.color, layers: design.layers, thumbnail: thumbDataUrl, updatedAt, source: "local" };
  await localStore.put(saved);
  return { saved, mode: "local", layers: design.layers };
}

export async function listDesigns(): Promise<{ designs: SavedDesign[]; mode: StorageMode }> {
  if (supabase) {
    const userId = await ensureSession();
    if (userId) {
      const { data, error } = await supabase
        .from("studio_designs")
        .select("id,name,blank,color,layers,thumbnail_url,updated_at")
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return {
        mode: "cloud",
        designs: (data ?? []).map((r) => ({
          id: r.id, name: r.name, blank: r.blank, color: r.color, layers: r.layers as Layer[],
          thumbnail: r.thumbnail_url, updatedAt: r.updated_at, source: "cloud" as const,
        })),
      };
    }
  }
  const all = await localStore.all<SavedDesign>();
  all.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return { designs: all, mode: "local" };
}

export async function deleteDesign(id: string, source: StorageMode) {
  if (source === "cloud" && supabase) {
    const { error } = await supabase.from("studio_designs").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  await localStore.del(id);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
