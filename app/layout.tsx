import type { Metadata, Viewport } from "next";
import { Inter, Sora, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";
import ScrollProgress from "@/components/fx/ScrollProgress";
import SpotlightTracker from "@/components/fx/SpotlightTracker";

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

export const metadata: Metadata = {
  title: "Dropy — Track your order from USA to India",
  description:
    "Track your Dropy order in real time from our USA warehouse to your doorstep in India. Live updates at every stage — packed, shipped, customs cleared, delivered.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Dropy",
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
            __html: `(function(){try{var s=localStorage.getItem('dropy-theme');var t=(s==='light'||s==='dark')?s:'light';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`,
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
          BottomNav's real rendered height is ~95px (ul's py-2 + the Link's
          own min-h-14/py-2 combo, whichever binds, plus its border) on top
          of its own bottom-[1rem+safe-area] floating offset — pb-24 (96px)
          undershoots that by 15-49px depending on the device, which hides
          real content (a last card, a CTA button) behind the floating bar.
          8rem plus the safe-area inset itself covers the bar's height, its
          offset, and a little breathing room above it.
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
