import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AnimateIn, StaggerChildren, StaggerItem } from "@/components/ui/animate-in";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden"
      style={{ fontFamily: "var(--font-body)" }}
    >
      {/* ─── Nav ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link
            href="/"
            className="text-lg font-black tracking-tight text-white"
            style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
          >
            RAID
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/login"
              className="px-4 py-2 text-sm text-zinc-400 transition-colors hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="group inline-flex items-center gap-1.5 bg-white px-4 py-2 text-sm font-semibold text-black transition-all hover:bg-zinc-100"
            >
              Get started
              <svg
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 7h10M8 3l4 4-4 4" />
              </svg>
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pb-16 pt-20 text-center">
        {/* Ambient glow orbs */}
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute left-1/2 top-[35%] h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.04]"
            style={{ filter: "blur(100px)", animation: "breathe 8s ease-in-out infinite" }}
          />
          <div
            className="absolute left-[20%] top-[60%] h-[300px] w-[400px] rounded-full bg-white/[0.025]"
            style={{ filter: "blur(80px)", animation: "breathe 11s ease-in-out infinite 3s" }}
          />
          <div
            className="absolute right-[15%] top-[25%] h-[200px] w-[300px] rounded-full bg-white/[0.02]"
            style={{ filter: "blur(60px)", animation: "breathe 9s ease-in-out infinite 1.5s" }}
          />
        </div>

        <div className="relative z-10 flex flex-col items-center">
          {/* Badge */}
          <div
            className="mb-8 inline-flex items-center gap-2 border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 backdrop-blur-sm"
            style={{ animation: "fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both 0ms" }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full bg-emerald-400"
              style={{ animation: "pulse-ring 2s ease-in-out infinite" }}
            />
            Now in early access
          </div>

          {/* Headline */}
          <h1
            className="max-w-3xl text-5xl font-black leading-[1.04] tracking-tight text-white sm:text-6xl lg:text-[76px]"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              animation: "fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both 80ms",
            }}
          >
            Know exactly{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(135deg, #ffffff 0%, #71717a 100%)",
              }}
            >
              how much
            </span>
            <br />
            you play.
          </h1>

          {/* Subtext */}
          <p
            className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-zinc-400"
            style={{ animation: "fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both 160ms" }}
          >
            RAID automatically tracks every gaming session and turns it into a
            beautiful journal. Just connect Discord and play — everything else is automatic.
          </p>

          {/* CTAs */}
          <div
            className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
            style={{ animation: "fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both 240ms" }}
          >
            <Link
              href="/signup"
              className="group inline-flex h-11 items-center gap-2 bg-white px-7 text-sm font-semibold text-black transition-all hover:bg-zinc-100 hover:shadow-[0_0_24px_rgba(255,255,255,0.15)]"
            >
              Get started free
              <svg
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center border border-white/10 px-7 text-sm font-medium text-zinc-300 transition-all hover:border-white/20 hover:text-white"
            >
              Sign in
            </Link>
          </div>

          {/* Product preview mockup */}
          <div
            className="mt-16 w-full max-w-md"
            style={{ animation: "fade-up 0.8s cubic-bezier(0.16,1,0.3,1) both 380ms" }}
          >
            <div
              className="overflow-hidden border border-white/[0.08] bg-[#111111]"
              style={{
                animation: "float 5s ease-in-out infinite",
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.04), 0 32px 80px rgba(0,0,0,0.8)",
              }}
            >
              {/* Mockup top bar */}
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
                <span
                  className="text-xs font-black text-white/50"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  RAID
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                    style={{ animation: "pulse-ring 2s ease-in-out infinite" }}
                  />
                  <span className="text-[11px] font-medium text-emerald-400">
                    Live session
                  </span>
                </div>
              </div>

              {/* Now playing */}
              <div className="flex items-center gap-4 border-b border-white/[0.06] px-5 py-4">
                <div
                  className="h-14 w-10 shrink-0 rounded"
                  style={{
                    background:
                      "linear-gradient(135deg, #27272a 0%, #3f3f46 100%)",
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    Elden Ring
                  </p>
                  <p className="text-xs text-zinc-500">FromSoftware · Action RPG</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                    Session
                  </p>
                  <p className="tabular-nums text-sm font-semibold text-white">
                    2h 14m
                  </p>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-4 divide-x divide-white/[0.06]">
                {[
                  { label: "Today", value: "4h 32m" },
                  { label: "Week", value: "18h 40m" },
                  { label: "Streak", value: "12 days" },
                  { label: "All time", value: "847h" },
                ].map((stat) => (
                  <div key={stat.label} className="px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                      {stat.label}
                    </p>
                    <p className="mt-0.5 tabular-nums text-xs font-semibold text-white">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Subtle shadow/reflection fade */}
            <div
              className="mx-auto h-6 w-3/4"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, transparent 70%)",
                filter: "blur(8px)",
                marginTop: "-2px",
              }}
            />
          </div>
        </div>
      </section>

      {/* ─── Strip ─── */}
      <AnimateIn from="fade">
        <div className="border-y border-white/[0.06] py-5 px-6">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-zinc-600">
            <span>Automatic detection</span>
            <span className="h-1 w-1 rounded-full bg-zinc-800" />
            <span>Works via Discord</span>
            <span className="h-1 w-1 rounded-full bg-zinc-800" />
            <span>200+ games</span>
            <span className="h-1 w-1 rounded-full bg-zinc-800" />
            <span>Real-time tracking</span>
            <span className="h-1 w-1 rounded-full bg-zinc-800" />
            <span>Public profile</span>
          </div>
        </div>
      </AnimateIn>

      {/* ─── Features ─── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <AnimateIn className="mb-14 text-center">
            <h2
              className="text-3xl font-bold text-white"
              style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
            >
              Built to understand how you play
            </h2>
            <p className="mt-3 text-zinc-500">
              Everything you need. Nothing you don&apos;t.
            </p>
          </AnimateIn>

          <StaggerChildren className="grid border border-white/[0.06] sm:grid-cols-3" staggerDelay={80}>
            {[
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                ),
                title: "Real-time tracking",
                desc: "Sessions sync the moment you launch a game. Watch your playtime grow live on your dashboard.",
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                ),
                title: "Gaming journal",
                desc: "Browse every session by date. See what you played, when, and for how long.",
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 3v18h18" />
                    <path d="m19 9-5 5-4-4-3 3" />
                  </svg>
                ),
                title: "Deep analytics",
                desc: "Streaks, genre breakdowns, weekly patterns, and your all-time most played games.",
              },
            ].map((feature, i) => (
              <StaggerItem key={i}>
                <div
                  className={`group h-full bg-[#0d0d0d] p-8 transition-all duration-300 hover:bg-[#121212] hover:shadow-[0_0_40px_rgba(255,255,255,0.03)] ${
                    i === 1 ? "border-x border-white/[0.06]" : ""
                  }`}
                >
                  <div className="mb-5 h-7 w-7 text-zinc-500 transition-colors duration-300 group-hover:text-zinc-300">
                    {feature.icon}
                  </div>
                  <h3 className="text-sm font-semibold text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500">{feature.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerChildren>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="border-t border-white/[0.06] px-6 py-24">
        <div className="mx-auto max-w-2xl">
          <AnimateIn className="mb-14 text-center">
            <h2
              className="text-3xl font-bold text-white"
              style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
            >
              Up and running in minutes
            </h2>
          </AnimateIn>

          <div>
            {[
              {
                n: "01",
                title: "Create your account",
                desc: "Sign up with Discord — no email form, no password required to start.",
              },
              {
                n: "02",
                title: "Join the Discord server",
                desc: "Connect your Discord account and join the RAID server — this is how we track your sessions via Rich Presence.",
              },
              {
                n: "03",
                title: "Play your games",
                desc: "Discord detects your games automatically via Rich Presence. Your stats appear on your dashboard in real time.",
              },
            ].map((step, i) => (
              <AnimateIn key={i} delay={i * 100}>
                <div
                  className={`flex gap-8 py-8 ${i < 2 ? "border-b border-white/[0.06]" : ""}`}
                >
                  <span
                    className="shrink-0 select-none text-5xl font-black leading-none text-white/[0.06] tabular-nums"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {step.n}
                  </span>
                  <div className="pt-1">
                    <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{step.desc}</p>
                  </div>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <AnimateIn>
        <section className="border-t border-white/[0.06] px-6 py-28 text-center">
          <div className="mx-auto max-w-md">
            <h2
              className="text-3xl font-bold text-white"
              style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
            >
              Start tracking today
            </h2>
            <p className="mt-4 text-zinc-500">Free to use. No credit card required.</p>
            <Link
              href="/signup"
              className="group mt-8 inline-flex h-11 items-center gap-2 bg-white px-8 text-sm font-semibold text-black transition-all hover:bg-zinc-100 hover:shadow-[0_0_24px_rgba(255,255,255,0.12)]"
            >
              Create free account
              <svg
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
          </div>
        </section>
      </AnimateIn>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/[0.06] px-6 py-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span
            className="text-sm font-black text-white"
            style={{ fontFamily: "var(--font-display)" }}
          >
            RAID
          </span>
          <div className="flex gap-6 text-sm text-zinc-600">
            <Link href="/download" className="transition-colors hover:text-white">
              Download
            </Link>
            <Link href="/login" className="transition-colors hover:text-white">
              Sign in
            </Link>
            <Link href="/signup" className="transition-colors hover:text-white">
              Sign up
            </Link>
          </div>
          <p className="text-sm text-zinc-700">&copy; {new Date().getFullYear()} RAID</p>
        </div>
      </footer>
    </div>
  );
}
