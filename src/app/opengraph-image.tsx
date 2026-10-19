import { ImageResponse } from "next/og";

// Link preview shown when the app link is shared on WhatsApp, email, Slack, etc.
export const alt = "PONGS Connect — PONGS INDIA team app";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#17232E", padding: 80, color: "#F5F6F4" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="96" height="96" viewBox="0 0 512 512">
            <rect width="512" height="512" rx="96" fill="#0F1A22" />
            <path d="M168 392V128h112a72 72 0 0 1 0 144H168" fill="none" stroke="#F5F6F4" strokeWidth="34" />
            <path d="M300 392h64" stroke="#B6E65B" strokeWidth="34" />
          </svg>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: 8 }}>
            PONGS<span style={{ marginLeft: 16, opacity: 0.6 }}>CONNECT</span>
          </div>
        </div>
        <div style={{ display: "flex", marginTop: "auto", fontSize: 26, color: "#B6E65B", letterSpacing: 4 }}>PONGS INDIA · TEAM APP</div>
        <div style={{ display: "flex", marginTop: 16, fontSize: 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 950 }}>
          One place for every city, team and project.
        </div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 28, color: "rgba(245,246,244,0.7)" }}>
          Chats · Site photos · Action items · Costing approvals
        </div>
      </div>
    ),
    size,
  );
}
