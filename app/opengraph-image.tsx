import { ImageResponse } from "next/og";
import { COMPANY } from "@/lib/company";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Social-share preview card (WhatsApp, LinkedIn, Twitter/X, iMessage, ...).
// Generated at request time from the same gradient + mark as the app
// icons, rather than a static asset — one source of truth for the brand
// look instead of a designed image someone has to remember to update.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #b788f2 0%, #9452e5 55%, #4c1d87 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 120,
              height: 120,
              borderRadius: 28,
              background: "rgba(255,255,255,0.14)",
              fontSize: 68,
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            {COMPANY.legalName[0]}
          </div>
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: -2,
            }}
          >
            {COMPANY.legalName}
          </div>
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 34,
            color: "rgba(255,255,255,0.88)",
          }}
        >
          Track your order — Global to India
        </div>
      </div>
    ),
    { ...size },
  );
}
