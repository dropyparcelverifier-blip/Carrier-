import { ImageResponse } from "next/og";

// Android/Chrome install icon — same gradient + "D" mark as apple-icon.tsx,
// generated at request time. 192x192 is Chrome's minimum size for offering
// "Add to Home Screen" at all; without an entry at this size the manifest's
// single 180x180 apple-icon entry doesn't satisfy the installability check.
// A plain route handler (not the icon.tsx file convention) can't export
// `size`/`contentType` — those get inlined below instead.
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #b788f2 0%, #9452e5 55%, #4c1d87 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <span
          style={{
            fontSize: 102,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: -2,
          }}
        >
          D
        </span>
      </div>
    ),
    { width: 192, height: 192 },
  );
}
