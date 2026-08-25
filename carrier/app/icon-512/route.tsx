import { ImageResponse } from "next/og";

// Splash-screen icon for PWA install — same gradient + "S" mark as
// apple-icon.tsx / icon-192, generated at request time. A plain route
// handler (not the icon.tsx file convention) can't export
// `size`/`contentType` — inlined below instead.
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
            fontSize: 272,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: -6,
          }}
        >
          S
        </span>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
