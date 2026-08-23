import { useEffect, useState } from "react";
import { countdownParts, embedUrl } from "../lib/format";
import defaultAvatar from "../assets/dime.webp";
import type { Settings } from "../lib/types";

/** "twitch" reads wrong in a sentence; brand names are capitalised. */
function platformLabel(platform: string | null): string {
  if (!platform) return "stream";
  const known: Record<string, string> = {
    twitch: "Twitch",
    youtube: "YouTube",
    kick: "Kick",
    tiktok: "TikTok",
  };
  return known[platform.toLowerCase()] ?? platform;
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-display text-2xl font-extrabold tabular-nums text-bone sm:text-3xl">
        {String(value).padStart(2, "0")}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
        {label}
      </span>
    </div>
  );
}

export function Hero({
  settings,
  hype,
  onJumpToChat,
}: {
  settings: Settings;
  hype: number;
  onJumpToChat: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const countdown = countdownParts(settings.next_stream_at, now);
  const embed = embedUrl(settings.stream_url, settings.stream_embed_url);

  return (
    <section id="live" className="scroll-mt-24 pt-6 sm:pt-10">
      <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-center">
        <div className="min-w-0">
          <div className="mb-5 inline-flex items-center gap-2.5 rounded-full glass px-3.5 py-2">
            <span className="relative flex h-2.5 w-2.5">
              {settings.is_live && (
                <span
                  className="absolute inline-flex h-full w-full rounded-full bg-hot-500"
                  style={{ animation: "pulse-ring 1.8s cubic-bezier(0,0,0.2,1) infinite" }}
                />
              )}
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  settings.is_live ? "bg-hot-500" : "bg-ash/60"
                }`}
              />
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/80">
              {settings.is_live ? "streaming right now" : "offline"}
            </span>
            {settings.location && (
              <>
                <span aria-hidden className="h-3 w-px bg-white/15" />
                <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-ash">
                  {settings.location}
                </span>
              </>
            )}
          </div>

          <h1 className="display-caps text-[clamp(3.25rem,11vw,7rem)] font-black leading-[0.84]">
            <span className="block text-bone">{settings.display_name}</span>
            <span
              className="block bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(100deg, var(--color-hot-400), var(--color-gold-400) 55%, var(--color-hot-500))",
              }}
            >
              {settings.is_live ? "is on air" : "back soon"}
            </span>
          </h1>

          {settings.tagline && (
            <p className="mt-5 max-w-lg text-balance-pretty text-lg text-ash">
              {settings.tagline}
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {settings.stream_url && (
              <a
                href={settings.stream_url}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-full bg-hot-500 px-6 py-3 text-sm font-semibold text-white transition-transform glow-hot hover:scale-[1.03] active:scale-100"
              >
                {settings.is_live
                ? "Watch live"
                : `Follow on ${platformLabel(settings.stream_platform)}`}
              </a>
            )}
            <button
              type="button"
              onClick={onJumpToChat}
              className="rounded-full glass px-6 py-3 text-sm font-semibold text-bone transition-colors hover:bg-white/5"
            >
              Say something
            </button>
          </div>

          {countdown && !countdown.done && (
            <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl glass px-5 py-4">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ash">
                  next stream
                </p>
                {settings.stream_title && (
                  <p className="mt-0.5 max-w-[22ch] truncate text-sm font-medium text-bone">
                    {settings.stream_title}
                  </p>
                )}
              </div>
              <div className="flex items-start gap-4 border-white/10 sm:border-l sm:pl-5">
                <Unit value={countdown.days} label="d" />
                <Unit value={countdown.hours} label="h" />
                <Unit value={countdown.minutes} label="m" />
                <Unit value={countdown.seconds} label="s" />
              </div>
            </div>
          )}
        </div>

        <div className="relative min-w-0">
          <div className="relative overflow-hidden rounded-[28px] glass p-2">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] bg-ink sm:aspect-video lg:aspect-[4/5]">
              {settings.is_live && embed ? (
                <iframe
                  title={settings.stream_title ?? "Live stream"}
                  src={embed}
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full border-0"
                />
              ) : (
                <>
                  <img
                    src={settings.avatar_url ?? defaultAvatar}
                    alt={settings.display_name}
                    className="absolute inset-0 h-full w-full object-cover object-top"
                    loading="eager"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-void via-void/25 to-transparent" />
                  {!settings.is_live && (
                    <div className="absolute bottom-4 left-4 right-4">
                      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-hot-400">
                        offline — but the room's open
                      </p>
                      <p className="mt-1 text-sm text-bone/80">
                        Chat, sign the wall, vote in the poll. It all still lands.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Hype meter — reactions in the last hour, live. */}
          <div className="mt-3 rounded-2xl glass px-4 py-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono uppercase tracking-[0.2em] text-ash">hype</span>
              <span className="font-semibold tabular-nums text-bone">
                {hype.toLocaleString()}
                <span className="ml-1 font-normal text-ash">this hour</span>
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${Math.min(100, Math.log10(hype + 1) * 33)}%`,
                  background:
                    "linear-gradient(90deg, var(--color-hot-500), var(--color-gold-400))",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
