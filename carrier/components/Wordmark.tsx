import Link from "next/link";
import { COMPANY } from "@/lib/company";

/**
 * The real mark, replacing the single-letter "D" in a gradient square.
 *
 * dc-mark.svg is the traced DC monogram, inlined rather than fetched:
 * it's ~1 kB, appears on every page, and the header shouldn't wait on a
 * network request to render the logo.
 *
 * It uses currentColor, so the same file serves light and dark mode by
 * inheriting the surrounding text colour — no second asset, no theme
 * switching.
 */
export default function Wordmark({ compact = false }: { compact?: boolean } = {}) {
  return (
    <Link
      href="/"
      aria-label={`${COMPANY.legalName} — home`}
      className="flex items-center gap-2.5 text-ink transition-opacity hover:opacity-80"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary p-1.5 text-on-primary">
        <svg viewBox="0 0 478 383" fill="currentColor" className="size-full" aria-hidden="true">
          <g transform="translate(0,383) scale(0.125,-0.125)"><path d="M33 3025 c-16 -29 -12 -2981 4 -2996 15 -16 988 -19 1168 -5 1061 86
1699 1226 1222 2184 -55 109 -82 152 -99 152 -30 0 -210 -146 -270 -220 -63
-76 -62 -70 -22 -158 286 -621 -65 -1344 -728 -1496 -72 -17 -762 -32 -817
-18 -31 7 -30 2112 2 2124 64 25 707 5 839 -25 120 -28 104 -33 176 53 60 72
118 128 218 212 23 19 42 38 42 42 0 24 -240 112 -388 143 -132 27 -1333 34
-1347 8z M2576 3035 c-11 -2 -47 -7 -80 -12 -851 -122 -1431 -1021 -1207
-1870 38 -146 131 -360 186 -428 29 -37 149 40 275 175 85 90 85 91 39 187
-355 748 295 1635 1094 1493 203 -36 441 -169 561 -314 29 -35 47 -33 92 12
20 21 86 85 147 141 124 118 122 113 72 168 -182 205 -482 373 -767 429 -83
16 -351 29 -412 19z M3415 767 c-273 -266 -599 -358 -951 -267 -76 20 -76 20
-108 -18 -59 -71 -152 -164 -222 -223 -85 -73 -85 -74 -8 -109 523 -238 1083
-150 1544 245 136 116 140 125 71 192 -288 278 -248 256 -326 180z"/></g>
        </svg>
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-lg font-semibold tracking-[-0.04em]">
            {COMPANY.legalName.replace(" Logistics", "")}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-tertiary">
            Logistics
          </span>
        </span>
      )}
    </Link>
  );
}
