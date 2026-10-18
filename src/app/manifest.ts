import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PONGS Connect",
    short_name: "PONGS",
    description: "Internal communication for PONGS INDIA",
    start_url: "/app",
    display: "standalone",
    background_color: "#F5F6F4",
    theme_color: "#17232E",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
