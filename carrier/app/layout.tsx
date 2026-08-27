import type { Metadata, Viewport } from "next";
import { Inter, Sora, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";
import ScrollProgress from "@/components/fx/ScrollProgress";
import SpotlightTracker from "@/components/fx/SpotlightTracker";
import OrganizationJsonLd from "@/components/OrganizationJsonLd";
import { SITE_URL as SITE_URL_CONST } from "@/lib/company";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  weight: ["400"],
  style: ["italic"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500"],
  display: "swap",
});

// Single source of truth — see lib/company.ts
const SITE_URL = SITE_URL_CONST;
const SITE_TITLE = "DotConnects Logistics — B2B freight and internal stock transfers";
const SITE_DESCRIPTION =
  "Move stock between your own warehouses, across borders. B2B consignments, internal transfers, customs and last-mile handover — one carton to full pallets, tracked at every stage.";

export const metadata: Metadata = {
  // Without this, relative URLs in openGraph/twitter images (and any
  // page's own metadata) can't resolve to an absolute URL — social
  // platforms and Search Console both require an absolute image URL.
  metadataBase: new URL(SITE_URL),
  // No title.template here — every page's own metadata already spells out
  // "— DotConnects Logistics" or "DotConnects Logistics" itself by hand (see app/about,
  // app/quote, etc.), so a template would double the brand name on every
  // page instead of just supplying it once for pages that omit their own.
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DotConnects Logistics",
  },
  // No root-level `alternates.canonical` here — Next merges metadata
  // top-down, so a "/" default here would apply to every page that
  // doesn't set its own, which is every page except this root layout.
  // Each page sets alternates.canonical to its own real path instead
  // (see app/about/page.tsx, app/quote/page.tsx, etc.).
  openGraph: {
    // A real photograph, not a text-rendered card. This is often the
    // first thing a prospect sees — a link forwarded on WhatsApp.
    images: [{ url: "/hero/og-card.webp", width: 1200, height: 630,
               alt: "A wrapped pallet of freight on a warehouse floor" }],
    type: "website",
    url: SITE_URL,
    siteName: "DotConnects Logistics",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_IN",
    // app/opengraph-image.tsx generates the actual image at request time —
    // Next.js picks it up automatically and doesn't need it listed here.
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets env(safe-area-inset-*) resolve to real values on notched iOS
  // devices instead of 0 — required for the .pt-safe / .pb-safe utilities
  // used by TopNav and BottomNav.
  viewportFit: "cover",
  themeColor: "#f5f3ec",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <OrganizationJsonLd />
        {/*
          Resolve the theme before first paint. Without this the page renders
          dark, then snaps to light on hydration — the classic flash.
        */}
        <script
          dangerouslySetInnerHTML={{
            // Light is the default; an explicit saved choice or a system
            // dark preference switches it.
            // Light is the hard default. The OS `prefers-color-scheme` is
            // deliberately NOT consulted — a visitor whose machine is in dark
            // mode was landing on the dark theme, which is not the intended
            // first impression. Only an explicit toggle switches it, and that
            // choice is then honoured on every later visit.
            __html: `(function(){try{var s=localStorage.getItem('dc-theme');var t=(s==='light'||s==='dark')?s:'light';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`,
          }}
        />
      </head>
      <body
        className="bg-canvas font-text text-ink antialiased"
        suppressHydrationWarning
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:border focus:border-hairline focus:bg-surface-1 focus:px-4 focus:py-2.5 focus:text-body-sm focus:text-ink focus:shadow-lg"
        >
          Skip to content
        </a>
        <ScrollProgress />
        <SpotlightTracker />
        <TopNav />
        {/*
          BottomNav's real rendered height is ~65-70px (ul's py-1.5 + the
          Link's min-h-11, plus its border) on top of its own
          bottom-[0.75rem+safe-area] floating offset. 8rem plus the
          safe-area inset covers that with real breathing room to spare —
          kept generous rather than tuned tight, since being `fixed`, the
          bar sits on top of whatever's at that screen position for the
          entire scroll, not just at the very end (see BottomNav.tsx).
        */}
        <main
          id="main"
          className="pb-[calc(8rem+env(safe-area-inset-bottom))] md:pb-0"
        >
          {children}
        </main>
        <Footer />
        <BottomNav />
      </body>
    </html>
  );
}
