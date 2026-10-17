import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PONGS Connect",
  description: "Internal communication for PONGS — city groups, tasks, reminders and CRM costing approvals.",
  appleWebApp: { capable: true, title: "PONGS Connect", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#059669", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
