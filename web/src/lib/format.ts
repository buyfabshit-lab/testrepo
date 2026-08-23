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
