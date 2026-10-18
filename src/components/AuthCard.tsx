import { LogoMark } from "./ui";

// Brand moment: a quiet architectural panel (tensioned membrane lines and a linear light) beside the form.
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-full bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="relative hidden overflow-hidden bg-[#17232E] p-12 text-white lg:flex lg:flex-col">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <defs>
            <pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" fill="none" stroke="rgba(213,222,228,0.06)" />
            </pattern>
          </defs>
          <rect width="600" height="800" fill="url(#g)" />
          {Array.from({ length: 14 }, (_, i) => (
            <path key={i} d={`M60 ${300 + i * 22} Q300 ${360 + i * 14} 540 ${300 + i * 22}`} fill="none" stroke="rgba(213,222,228,0.14)" />
          ))}
          <path d="M60 280v340M540 280v340" stroke="rgba(213,222,228,0.35)" strokeWidth="3" />
          <path d="M120 250h360" stroke="#B6E65B" strokeWidth="3" strokeLinecap="round" />
          <path d="M120 250h360" stroke="#B6E65B" strokeWidth="18" strokeLinecap="round" opacity="0.08" />
        </svg>
        <div className="relative flex items-center gap-3">
          <LogoMark size={32} />
          <div className="font-display text-[14px] font-bold tracking-[0.2em]">
            PONGS<span className="ml-1.5 font-semibold opacity-60">CONNECT</span>
          </div>
        </div>
        <div className="relative mt-auto max-w-md">
          <div className="mb-3 text-[11px] font-semibold tracking-[0.12em] text-[#B6E65B] uppercase">Precision in every detail</div>
          <p className="font-display text-[28px] leading-tight font-bold tracking-[-0.01em]">
            One place for sales, design, site and accounts to move every project forward.
          </p>
          <p className="mt-3 text-[14px] text-white/60">Stretch ceilings · Acoustics · Architectural lighting</p>
        </div>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark size={32} />
            <div className="font-display text-[14px] font-bold tracking-[0.2em] text-ink">
              PONGS<span className="ml-1.5 font-semibold opacity-60">CONNECT</span>
            </div>
          </div>
          <h1 className="font-display text-[24px] font-bold tracking-[-0.015em]">{title}</h1>
          {subtitle && <p className="mt-1 mb-6 text-[14px] text-ink-3">{subtitle}</p>}
          <div className="panel p-6">{children}</div>
          <p className="mt-6 text-center text-[11.5px] text-ink-4">PONGS INDIA · Internal use only</p>
        </div>
      </section>
    </main>
  );
}
