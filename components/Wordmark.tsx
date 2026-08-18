import Link from "next/link";

export default function Wordmark() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 text-ink transition-opacity hover:opacity-80"
    >
      {/* Same violet ramp as app/icon.svg / apple-icon.tsx, so the in-app
          mark and the browser-tab/home-screen icon read as one brand. */}
      <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-deep font-display text-sm font-bold text-on-primary">
        D
      </span>
      <span className="font-display text-lg font-semibold tracking-[-0.04em]">
        Dropy
      </span>
    </Link>
  );
}
