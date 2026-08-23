/**
 * Anonymous fan identity.
 *
 * There is no login. Each browser mints a uuid on first visit and keeps it in
 * localStorage; it is what dedupes hearts and poll votes and what the
 * rate-limit triggers count against. It is a convenience key, not a security
 * boundary — clearing storage mints a new one. Nothing sensitive hangs off it.
 */

const KEY = "dime.fan.v1";

export type Fan = { id: string; handle: string; hue: number };

const ADJECTIVES = [
  "neon", "velvet", "static", "midnight", "glitter", "feral", "chrome",
  "sugar", "riot", "lucid", "hazy", "電", "cosmic", "violet", "rogue",
];
const NOUNS = [
  "moth", "siren", "comet", "static", "wraith", "peach", "ember", "orbit",
  "vixen", "koi", "pixel", "onyx", "lark", "nova", "husk",
];

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback for older Safari / insecure origins.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function randomHandle(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${a}${n}${Math.floor(Math.random() * 90 + 10)}`.slice(0, 24);
}

function mint(): Fan {
  return { id: uuid(), handle: randomHandle(), hue: Math.floor(Math.random() * 360) };
}

export function loadFan(): Fan {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Fan>;
      if (parsed.id && parsed.handle) {
        return {
          id: parsed.id,
          handle: parsed.handle.slice(0, 24),
          hue: typeof parsed.hue === "number" ? parsed.hue : 322,
        };
      }
    }
  } catch {
    // Private mode, disabled storage, corrupt JSON — all fall through to a
    // fresh in-memory identity rather than breaking the page.
  }
  const fresh = mint();
  saveFan(fresh);
  return fresh;
}

export function saveFan(fan: Fan): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(fan));
  } catch {
    /* non-fatal */
  }
}
