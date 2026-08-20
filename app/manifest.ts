import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DotConnects Logistics — Global to India shipping",
    short_name: "DotConnects Logistics",
    description:
      "Track your DotConnects Logistics order in real time from our origin warehouse to your doorstep in India.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f3ec",
    theme_color: "#f5f3ec",
    icons: [
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
      {
        // Chrome/Android's minimum size to consider the app installable at
        // all — the 180x180 apple-icon entry alone doesn't satisfy it.
        src: "/icon-192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
