export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="flex min-h-screen bg-[#0a0a0a]"
      style={{ fontFamily: "var(--font-body)" }}
    >
      {/* ─── Left branding panel ─── */}
      <div
        className="relative hidden overflow-hidden border-r border-white/[0.06] lg:flex lg:w-[44%] lg:flex-col lg:justify-between lg:px-14 lg:py-12"
        style={{
          background: "#080808",
          backgroundImage: `
            radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.025) 0%, transparent 55%),
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
          `,
          backgroundSize: "auto, 52px 52px, 52px 52px",
        }}
      >
        {/* Animated glow orb bottom-left */}
        <div
          className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)",
            filter: "blur(48px)",
            animation: "breathe 9s ease-in-out infinite",
          }}
        />
        {/* Animated glow orb top-right */}
        <div
          className="pointer-events-none absolute -right-12 top-1/4 h-48 w-48 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)",
            filter: "blur(40px)",
            animation: "breathe 11s ease-in-out infinite 2s",
          }}
        />

        {/* Content */}
        <div className="relative z-10">
          <span
            className="text-xl font-black tracking-tight text-white"
            style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
          >
            RAID
          </span>
        </div>

        <div className="relative z-10">
          <p
            className="text-[2.1rem] font-bold leading-tight text-white"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
          >
            Know exactly how
            <br />
            much you play.
          </p>

          <div className="mt-10 space-y-4">
            {[
              "Automatic game tracking via Discord",
              "Real-time dashboard & session history",
              "Public profile with shareable stats",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <svg
                  className="h-4 w-4 shrink-0 text-zinc-600"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1" />
                  <path
                    d="M5 8l2 2 4-4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-sm text-zinc-400">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-zinc-700">
          &copy; {new Date().getFullYear()} RAID
        </p>
      </div>

      {/* ─── Right form panel ─── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-10 lg:hidden">
          <span
            className="text-xl font-black tracking-tight text-white"
            style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
          >
            RAID
          </span>
        </div>

        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}
