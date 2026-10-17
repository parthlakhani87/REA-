import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PONGS Connect",
    short_name: "PONGS",
    description: "Internal communication for PONGS",
    start_url: "/app",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#059669",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
