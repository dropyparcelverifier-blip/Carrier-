import type { NextConfig } from "next";

/*
 * 'unsafe-inline' on script-src is required by the two inline <script>
 * tags in app/layout.tsx (the pre-paint theme-init script, and the
 * Organization JSON-LD) — both are fixed, code-defined content with no
 * user input reaching them, not a case of trusting arbitrary third-party
 * script. A nonce-based CSP would remove the need for 'unsafe-inline' but
 * requires per-request middleware to generate and thread the nonce through
 * every render, which is a bigger structural change than this pass covers.
 *
 * 'unsafe-eval' is added ONLY in development — Next.js's dev-mode Fast
 * Refresh/HMR client and React DevTools bridge rely on eval()-based source
 * maps to work at all. Without it, dev mode silently fails after the
 * initial HTML paints: the page's static markup (header/footer, anything
 * that needs no JS to render) shows up fine, but every client component
 * that needs its own JS to mount — which in practice is most of a page's
 * actual content — never does, so the page reads as "only header and
 * footer visible." Production builds don't use eval-based HMR, so they
 * stay on the stricter script-src with no 'unsafe-eval'.
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://images.unsplash.com",
  "font-src 'self' data:",
  `connect-src 'self'${process.env.NODE_ENV === "development" ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          // Same protection as frame-ancestors above, for browsers that
          // don't support CSP frame-ancestors (legacy, but free to include).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
