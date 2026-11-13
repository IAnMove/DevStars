import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import { getScoreColorHex } from "@/lib/gamification";
import { getClientIp, ogRenderLimiter } from "@/lib/rate-limit";
import { formatDateEn, getLocalProfile } from "@/lib/seo";
import type { LocalProfile } from "@/lib/seo";
import { singleton } from "@/lib/singleton";
import { OG_IMAGE_SIZE, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import { isValidUsername } from "@/lib/username";

// Social cards (1200x630 PNG):
//   /og/_site.png        generic card of the site
//   /og/<username>.png   card of a profile, drawn ONLY from local data
//                        (leaderboard row or in-memory cache; never calls the
//                        GitHub API). Unknown users get the generic card.
// The ".png" suffix lets Cloudflare cache them by extension with the
// Cache-Control below, without any Cache Rule.

export const dynamic = "force-dynamic";

const SITE_KEY = "_site";
const CACHE_SITE = "public, max-age=86400, s-maxage=604800";
const CACHE_PROFILE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
const CACHE_UNKNOWN = "public, max-age=300";

// Rendered PNGs (40-90 KB each) kept outside the V8 heap
const MAX_CACHED_IMAGES = 60;
const AVATAR_TIMEOUT_MS = 2500;
const AVATAR_MAX_BYTES = 300 * 1024;

interface OgState {
  images: Map<string, Buffer>;
  inFlight: Map<string, Promise<Buffer>>;
  chain: Promise<unknown>; // renders run one at a time (CPU bound, 1 vCPU)
}

const state = singleton<OgState>("og", () => ({
  images: new Map(),
  inFlight: new Map(),
  chain: Promise.resolve(),
}));

// The bundled font (Geist) covers Latin scripts. Anything else would make the
// renderer download fonts from a third party, so such text is dropped.
function latinOnly(text: string | null | undefined): string {
  if (!text) return "";
  const cleaned = text.replace(/[^\u0020-\u007e\u00a0-\u017f]/g, "").trim();
  return cleaned.length >= Math.ceil(text.trim().length * 0.8) ? cleaned : "";
}

async function fetchAvatar(avatarUrl: string | null): Promise<string | null> {
  if (!avatarUrl) return null;
  try {
    const url = new URL(avatarUrl);
    if (url.protocol !== "https:" || url.hostname !== "avatars.githubusercontent.com") return null;
    url.searchParams.set("s", "240");
    const res = await fetch(url, {
      signal: AbortSignal.timeout(AVATAR_TIMEOUT_MS),
      cache: "no-store",
    });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\/(png|jpeg|gif)$/.test(type)) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > AVATAR_MAX_BYTES) return null;
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

function Star({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c084fc" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <path
        fill="url(#g)"
        d="M32 8.5l7.2 14.9 16.3 2.2-11.9 11.4 3 16.2L32 45.3l-14.6 7.9 3-16.2L8.5 25.6l16.3-2.2z"
      />
    </svg>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        color: "#ffffff",
        backgroundColor: "#030712",
        backgroundImage: "linear-gradient(135deg, #030712 0%, #111827 55%, #2e1065 100%)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", fontSize: 36, fontWeight: 700 }}>
        <Star size={52} />
        <span style={{ marginLeft: 16 }}>{SITE_NAME}</span>
      </div>
      {children}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 26,
          color: "#9ca3af",
        }}
      >
        <span>Based on public GitHub activity only</span>
        <span>{new URL(SITE_URL).host}</span>
      </div>
    </div>
  );
}

function siteCard() {
  return (
    <Frame>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>
          {SITE_TAGLINE}
        </div>
        <div style={{ display: "flex", marginTop: 24, fontSize: 34, color: "#d8b4fe" }}>
          A 0-100 score, titles, badges and a public leaderboard
        </div>
      </div>
    </Frame>
  );
}

function profileCard(profile: LocalProfile, avatar: string | null) {
  const name = latinOnly(profile.name) || profile.login;
  const hasScore = profile.score !== null;
  const periodLabel =
    profile.period === "all"
      ? // No rank here: it changes whenever anyone else is saved, and CDNs keep the image for a day
        `All-time score on the leaderboard${
          profile.evaluatedAt ? ` · evaluated ${formatDateEn(profile.evaluatedAt)}` : ""
        }`
      : "Score for the last year";

  return (
    <Frame>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", maxWidth: hasScore ? 740 : 1070 }}>
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                width={168}
                height={168}
                alt=""
                style={{ borderRadius: 84, border: "4px solid #374151" }}
              />
            ) : (
              <div
                style={{
                  width: 168,
                  height: 168,
                  borderRadius: 84,
                  border: "4px solid #374151",
                  backgroundColor: "#1f2937",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 80,
                  fontWeight: 700,
                  color: "#d8b4fe",
                }}
              >
                {profile.login.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 36 }}>
              <div
                style={{
                  display: "flex",
                  fontSize: name.length > 18 ? 44 : 60,
                  fontWeight: 700,
                  lineHeight: 1.1,
                }}
              >
                {name.length > 36 ? `${name.slice(0, 34)}...` : name}
              </div>
              <div style={{ display: "flex", marginTop: 10, fontSize: 34, color: "#9ca3af" }}>
                @{profile.login}
              </div>
              <div style={{ display: "flex", marginTop: 22, fontSize: 38, color: "#d8b4fe" }}>
                {hasScore && profile.title ? profile.title : "GitHub developer score"}
              </div>
            </div>
          </div>

          {hasScore && (
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span
                style={{
                  fontSize: 190,
                  fontWeight: 700,
                  lineHeight: 1,
                  color: getScoreColorHex(profile.score ?? 0),
                }}
              >
                {profile.score}
              </span>
              <span style={{ fontSize: 48, color: "#9ca3af", marginLeft: 8 }}>/100</span>
            </div>
          )}
        </div>
        {hasScore && (
          <div style={{ display: "flex", marginTop: 36, fontSize: 28, color: "#e5e7eb" }}>
            {periodLabel}
          </div>
        )}
      </div>
    </Frame>
  );
}

function renderQueued(key: string, build: () => Promise<React.ReactElement>): Promise<Buffer> {
  const pending = state.inFlight.get(key);
  if (pending) return pending;

  const job = state.chain.then(async () => {
    const element = await build();
    const response = new ImageResponse(element, { ...OG_IMAGE_SIZE });
    const png = Buffer.from(await response.arrayBuffer());
    state.images.set(key, png);
    while (state.images.size > MAX_CACHED_IMAGES) {
      const oldest = state.images.keys().next().value;
      if (oldest === undefined) break;
      state.images.delete(oldest);
    }
    return png;
  });
  state.chain = job.catch(() => {});
  state.inFlight.set(key, job);
  const clear = () => {
    if (state.inFlight.get(key) === job) state.inFlight.delete(key);
  };
  job.then(clear, clear);
  return job;
}

function pngResponse(png: Buffer, cacheControl: string, cache: "HIT" | "MISS"): NextResponse {
  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(png.length),
      "Cache-Control": cacheControl,
      "X-Cache": cache,
    },
  });
}

function plain(status: number, text: string, extra: Record<string, string> = {}): NextResponse {
  return new NextResponse(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  const target = file.endsWith(".png") ? file.slice(0, -4) : "";
  const isSite = target === SITE_KEY;
  if (!isSite && !isValidUsername(target)) return plain(404, "Not found");

  // Users we know nothing about get the generic card: an arbitrary username
  // must not be able to trigger a render (CPU) of its own.
  const local = isSite ? null : getLocalProfile(target);
  const profile = local?.known ? local : null;
  // The key changes whenever what the card shows changes
  const key = profile
    ? [
        profile.login.toLowerCase(),
        profile.period,
        profile.score,
        profile.title,
        profile.evaluatedAt,
        profile.name,
      ].join("|")
    : SITE_KEY;
  const cacheControl = isSite ? CACHE_SITE : profile ? CACHE_PROFILE : CACHE_UNKNOWN;

  const cached = state.images.get(key);
  if (cached) return pngResponse(cached, cacheControl, "HIT");

  if (!state.inFlight.has(key)) {
    const decision = ogRenderLimiter.consume(getClientIp(request.headers));
    if (!decision.ok) {
      return plain(429, "Too many requests", { "Retry-After": String(decision.retryAfterSec) });
    }
  }

  try {
    const png = await renderQueued(key, async () =>
      profile ? profileCard(profile, await fetchAvatar(profile.avatarUrl)) : siteCard()
    );
    return pngResponse(png, cacheControl, "MISS");
  } catch (err) {
    console.error("[og] render failed:", err instanceof Error ? err.message : err);
    return plain(500, "Could not render image");
  }
}
