export function money(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function shortTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** Splits a future timestamp into countdown parts, clamped at zero. */
export function countdownParts(target: string | null, now: number) {
  if (!target) return null;
  const ms = new Date(target).getTime() - now;
  if (Number.isNaN(ms)) return null;
  const clamped = Math.max(0, ms);
  return {
    done: ms <= 0,
    days: Math.floor(clamped / 86_400_000),
    hours: Math.floor((clamped % 86_400_000) / 3_600_000),
    minutes: Math.floor((clamped % 3_600_000) / 60_000),
    seconds: Math.floor((clamped % 60_000) / 1000),
  };
}

/**
 * Converts a channel/watch URL into something embeddable. Returns null when
 * we cannot be confident, in which case the UI shows a link-out instead of a
 * broken iframe.
 */
export function embedUrl(raw: string | null, explicit: string | null): string | null {
  if (explicit) return explicit;
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  const parent = typeof location !== "undefined" ? location.hostname : "localhost";

  if (host === "twitch.tv") {
    const channel = u.pathname.split("/").filter(Boolean)[0];
    if (!channel) return null;
    return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${parent}&muted=true`;
  }
  if (host === "youtube.com" && u.searchParams.get("v")) {
    return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
  }
  if (host === "youtu.be") {
    const id = u.pathname.split("/").filter(Boolean)[0];
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  return null;
}

/**
 * The viewer's IANA timezone, or "" if the browser won't say.
 */
export function viewerZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

/**
 * A time rendered in a specific zone, with its short name attached
 * ("8:00 PM EDT"). DST is handled by Intl, so this stays correct across the
 * March/November switches without any date maths of our own.
 *
 * Returns null for an unusable zone rather than throwing, so a typo in
 * dime_settings.timezone degrades to "no second line" instead of a blank page.
 */
export function timeInZone(iso: string, timeZone: string): string | null {
  if (!timeZone) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

/**
 * True when the viewer is somewhere that shares DIME's wall clock. Compared by
 * actual offset rather than by zone name, so America/New_York and
 * America/Toronto correctly count as the same and we don't nag a Toronto fan
 * with a redundant second line.
 */
export function sharesClockWith(iso: string, timeZone: string): boolean {
  if (!timeZone) return true;
  try {
    const at = new Date(iso);
    const here = new Intl.DateTimeFormat("en-US", {
      hour: "numeric", minute: "2-digit", hour12: false,
    }).format(at);
    const there = new Intl.DateTimeFormat("en-US", {
      hour: "numeric", minute: "2-digit", hour12: false, timeZone,
    }).format(at);
    return here === there;
  } catch {
    return true;
  }
}
