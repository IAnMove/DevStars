import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// No nonces (they would force every page to render dynamically): Next's
// bootstrap needs inline scripts, and charts/Tailwind use inline styles.
// The Cloudflare hosts only matter if Web Analytics is ever switched on.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://static.cloudflareinsights.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://avatars.githubusercontent.com",
  "font-src 'self' data:",
  `connect-src 'self' https://cloudflareinsights.com${isDev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  // Only honoured over HTTPS (Cloudflare terminates TLS for the site)
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // JSON is fetched by pages (and by crawlers that render them) but must
      // not show up in search results on its own
      { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
      // Pre-rendered HTML: short shared-cache lifetime so a CDN can never
      // keep pointing at the chunks of an old build for long
      {
        source: "/",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, s-maxage=300, stale-while-revalidate=600" },
        ],
      },
    ];
  },
};

export default nextConfig;
