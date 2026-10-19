"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Download, Share2 } from "lucide-react";
import { useInstall } from "../DeviceSetup";

// "Install app" appears only where the browser supports one-tap install (Chrome/Edge/Samsung on Android & desktop).
export function InstallButton() {
  const { canPrompt, installed, install } = useInstall();
  if (installed || !canPrompt) return null;
  return (
    <button onClick={install} className="btn inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 px-5 text-[15px] font-semibold text-white hover:bg-white/10">
      <Download className="h-4 w-4" /> Install app
    </button>
  );
}

const SHARE_TEXT = "Join the PONGS team on PONGS Connect — our internal app for chats, action items and costing approvals.";

export function ShareButtons({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator !== "undefined" && "share" in navigator), []);

  async function share() {
    try {
      await navigator.share({ title: "PONGS Connect", text: SHARE_TEXT, url });
    } catch {}
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT}\n${url}`)}`}
        target="_blank"
        rel="noreferrer"
        className="btn-primary h-10 rounded-xl px-4"
      >
        <Share2 className="h-4 w-4" /> Share on WhatsApp
      </a>
      {canShare && (
        <button onClick={share} className="btn-secondary h-10 rounded-xl px-4">
          <Share2 className="h-4 w-4" /> Share…
        </button>
      )}
      <button onClick={copy} className="btn-secondary h-10 rounded-xl px-4">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Link copied" : "Copy link"}
      </button>
    </div>
  );
}
