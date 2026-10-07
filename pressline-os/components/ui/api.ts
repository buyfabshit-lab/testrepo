"use client";
/** Small fetch wrapper for the JSON API routes (docs/API.md). Same-origin cookies carry the staff session. */
export class ApiError extends Error {
  constructor(message: string, public status: number, public body?: unknown) { super(message); }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    credentials: "same-origin",
    headers: init.body === undefined ? {} : { "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init.signal,
  });
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) {
    const msg = (json && typeof json === "object" && "error" in json && typeof (json as { error: unknown }).error === "string")
      ? (json as { error: string }).error
      : `${res.status} ${res.statusText}`;
    throw new ApiError(msg, res.status, json);
  }
  return json as T;
}
