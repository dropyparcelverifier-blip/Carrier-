import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS home-screen icon, generated at request time from the same gradient +
// "D" mark as Wordmark.tsx / icon.svg — no external image tooling needed.
export default function AppleIcon() {
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
            fontSize: 96,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: -2,
          }}
        >
          D
        </span>
      </div>
    ),
    { ...size },
  );
}
