import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, BellRing, Images, KeyRound, ListChecks, LogIn, MapPin, Smartphone, SquarePlus, Share } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { siteUrl } from "@/lib/site";
import { LogoMark } from "@/components/ui";
import { InstallButton, ShareButtons } from "@/components/landing/LandingActions";

export const metadata: Metadata = {
  title: "PONGS Connect — PONGS INDIA team app",
  description: "Sign in to PONGS Connect: city groups for Sales, Project, Accounts and Dispatch, action items with reminders and CRM costing approvals.",
};

const FEATURES = [
  { icon: MapPin, title: "Your city, your team", body: "Every city has Sales, Project, Accounts and Dispatch groups, plus direct messages." },
  { icon: Images, title: "Photos & site videos", body: "Share pictures, videos, drawings and documents straight from your phone." },
  { icon: ListChecks, title: "Action items that don't slip", body: "Reminders until a task is acknowledged, then until it's done." },
  { icon: BadgeCheck, title: "Costing approvals", body: "Quotations from PONGS CRM arrive for approval in one tap." },
];

// Public landing page: the link you share with employees. Signed-in people go straight to the app.
export default async function Landing() {
  if (await getCurrentUser().catch(() => null)) redirect("/app");
  const url = siteUrl();

  return (
    <main className="min-h-full bg-canvas text-ink">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#17232E] text-white">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <defs>
            <pattern id="lg" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M48 0H0V48" fill="none" stroke="rgba(213,222,228,0.05)" />
            </pattern>
          </defs>
          <rect width="1200" height="700" fill="url(#lg)" />
          {Array.from({ length: 16 }, (_, i) => (
            <path key={i} d={`M620 ${250 + i * 22} Q900 ${320 + i * 14} 1180 ${250 + i * 22}`} fill="none" stroke="rgba(213,222,228,0.10)" />
          ))}
          <path d="M700 200h420" stroke="#B6E65B" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
        </svg>

        <div className="relative mx-auto max-w-5xl px-5 pt-5 pb-14 md:pt-8 md:pb-24">
          <nav className="flex items-center gap-3">
            <LogoMark size={34} />
            <div className="font-display text-[14px] font-bold tracking-[0.2em]">
              PONGS<span className="ml-1.5 font-semibold opacity-60">CONNECT</span>
            </div>
            <Link href="/login" className="ml-auto rounded-lg border border-white/20 px-3.5 py-1.5 text-[13px] font-medium hover:bg-white/10">
              Sign in
            </Link>
          </nav>

          <div className="mt-14 max-w-2xl md:mt-24">
            <div className="mb-4 text-[11.5px] font-semibold tracking-[0.14em] text-[#B6E65B] uppercase">PONGS INDIA · Team app</div>
            <h1 className="font-display text-[34px] leading-[1.08] font-bold tracking-[-0.02em] md:text-[52px]">
              One place for every city, team and project.
            </h1>
            <p className="mt-4 max-w-xl text-[16px] text-white/70 md:text-[18px]">
              Chat with your department, share site photos, track action items and approve costings — on your phone and computer.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="btn inline-flex h-11 items-center gap-2 rounded-xl bg-[#B6E65B] px-6 text-[15px] font-semibold text-[#17232E] hover:brightness-95">
                <LogIn className="h-4 w-4" /> Sign in to PONGS Connect
              </Link>
              <InstallButton />
              <a href="#install" className="btn inline-flex h-11 items-center gap-2 rounded-xl px-4 text-[15px] font-medium text-white/80 hover:text-white">
                <Smartphone className="h-4 w-4" /> Get it on your phone
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* First time */}
      <section className="mx-auto max-w-5xl px-5 py-12 md:py-16">
        <div className="eyebrow mb-2">First time here?</div>
        <h2 className="font-display text-[24px] font-bold tracking-[-0.01em] md:text-[28px]">Get started in three steps</h2>
        <ol className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            { icon: LogIn, title: "Sign in", body: "Use the email and temporary password your admin sent you." },
            { icon: KeyRound, title: "Set your password", body: "You'll be asked to choose your own password the first time." },
            { icon: BellRing, title: "Install & turn on alerts", body: "Add the app to your phone and allow notifications so you never miss a task." },
          ].map((s, i) => (
            <li key={s.title} className="panel flex gap-3 p-5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#17232E] font-display text-[14px] font-bold text-[#B6E65B]">{i + 1}</span>
              <div>
                <div className="flex items-center gap-2 font-semibold">
                  <s.icon className="h-4 w-4 text-ink-3" /> {s.title}
                </div>
                <p className="mt-1 text-[13.5px] text-ink-2">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link href="/login" className="btn-primary mt-6 h-11 rounded-xl px-6 text-[15px]">
          <LogIn className="h-4 w-4" /> Sign in now
        </Link>
      </section>

      {/* Features */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-5xl gap-6 px-5 py-12 sm:grid-cols-2 md:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <f.icon className="h-5 w-5 text-ink-2" strokeWidth={1.75} />
              <div className="mt-3 font-semibold">{f.title}</div>
              <p className="mt-1 text-[13.5px] text-ink-3">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Install */}
      <section id="install" className="mx-auto max-w-5xl scroll-mt-4 px-5 py-12 md:py-16">
        <div className="eyebrow mb-2">On your phone</div>
        <h2 className="font-display text-[24px] font-bold tracking-[-0.01em] md:text-[28px]">Install PONGS Connect like an app</h2>
        <p className="mt-2 max-w-2xl text-[14px] text-ink-2">
          No app store needed. Once installed it opens full screen from your home screen and alerts you about messages, reminders and approvals.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <div className="panel p-5">
            <div className="font-semibold">Android</div>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[13.5px] text-ink-2">
              <li>Open this page in <b>Chrome</b>.</li>
              <li>
                Tap <b>Install app</b> (or menu <b>⋮</b> → <b>Install app</b> / <b>Add to Home screen</b>).
              </li>
              <li>Open PONGS Connect from your home screen, sign in and tap <b>Turn on notifications</b>.</li>
            </ol>
          </div>
          <div className="panel p-5">
            <div className="font-semibold">iPhone (iOS 16.4 or newer)</div>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[13.5px] text-ink-2">
              <li>Open this page in <b>Safari</b>.</li>
              <li>
                Tap <Share className="inline h-3.5 w-3.5" /> <b>Share</b>, then <SquarePlus className="inline h-3.5 w-3.5" /> <b>Add to Home Screen</b>.
              </li>
              <li>Open PONGS Connect <b>from the Home Screen icon</b>, sign in and tap <b>Turn on notifications</b>.</li>
            </ol>
          </div>
        </div>
      </section>

      {/* Share */}
      <section className="mx-auto max-w-5xl px-5 pb-14">
        <div className="panel flex flex-col gap-4 p-5 md:flex-row md:items-center">
          <div className="flex-1">
            <div className="font-semibold">Share PONGS Connect with a colleague</div>
            <p className="mt-0.5 text-[13.5px] text-ink-3">
              Send this link. They sign in with the account your admin created for them.
            </p>
            <div className="mt-2 truncate font-mono text-[12.5px] text-ink-2">{url}</div>
          </div>
          <ShareButtons url={url} />
        </div>
      </section>

      <footer className="border-t border-line py-6 text-center text-[12px] text-ink-4">PONGS INDIA · Internal use only · Precision in every detail</footer>
    </main>
  );
}
