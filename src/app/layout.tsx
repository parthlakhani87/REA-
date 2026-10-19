import type { Metadata, Viewport } from "next";
import "./globals.css";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  openGraph: {
    type: "website",
    siteName: "PONGS Connect",
    title: "PONGS Connect — PONGS INDIA team app",
    description: "Chats, site photos, action items and costing approvals for the PONGS team. Tap to sign in.",
    url: "/",
  },
  twitter: { card: "summary_large_image" },
  title: "PONGS Connect",
  description: "Internal communication for PONGS INDIA — departments, projects, action items and CRM costing approvals.",
  appleWebApp: { capable: true, title: "PONGS Connect", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  applicationName: "PONGS Connect",
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#17232E" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1218" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Applied before paint so the chosen theme never flashes. Light is the default.
const themeScript = `try{var t=localStorage.getItem("pc:theme");if(t==="system")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t==="dark"?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@600;700&display=swap"
        />
      </head>
      <body className="font-sans text-[14px] antialiased">{children}</body>
    </html>
  );
}
