import type { MetadataRoute } from "next";

// Makes PONGS Connect installable as a phone/desktop app (Add to Home Screen / Install app).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "PONGS Connect",
    short_name: "PONGS",
    description: "Internal communication for PONGS INDIA",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#17232E",
    theme_color: "#17232E",
    categories: ["business", "productivity", "social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Conversations", url: "/app?view=chats", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Action items", url: "/app?view=tasks", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Costing approvals", url: "/app?view=approvals", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
