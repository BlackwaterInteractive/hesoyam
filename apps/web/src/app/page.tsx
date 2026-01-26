import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ─── Navigation ─── */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="text-xl font-bold tracking-tight text-white">
            Hesoyam
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:text-white"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden px-6 pt-24 pb-20 sm:pt-32 sm:pb-28">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center">
          <div className="h-[480px] w-[720px] -translate-y-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Track Every Hour
            </span>{" "}
            <br className="hidden sm:block" />
            of Your Gaming Journey
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400 sm:text-xl">
            Automatic game time tracking for PC gamers. See your stats, discover
            patterns, and share your gaming profile.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-600 px-8 text-base font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-500 hover:shadow-emerald-500/30"
            >
              Get Started Free
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-zinc-700 px-8 text-base font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="scroll-mt-20 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-zinc-400">
              Get up and running in under two minutes.
            </p>
          </div>

          <div className="mt-16 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-lg font-bold text-white">
                1
              </div>
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white">
                  Download the Tracker
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Install a lightweight Windows agent that runs quietly in your
                  system tray. No performance impact, no bloat.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-lg font-bold text-white">
                2
              </div>
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white">
                  Play Your Games
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  The tracker automatically detects when you launch a game and
                  records your session. No manual input needed.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-lg font-bold text-white">
                3
              </div>
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white">
                  View Your Stats
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Open your dashboard to see total playtime, session history,
                  genre breakdowns, and weekly trends at a glance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Built for Gamers
            </h2>
            <p className="mt-4 text-lg text-zinc-400">
              Everything you need to understand and share your gaming habits.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2">
            {/* Feature 1 */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">
                Automatic Detection
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Recognizes 200+ popular PC games automatically via process
                signatures. Community-driven library that keeps growing.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">
                Real-time Tracking
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Sessions sync to your dashboard as you play. See your current
                game, session length, and live activity updates.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 3v18h18" />
                  <path d="m19 9-5 5-4-4-3 3" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">
                Detailed Analytics
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Genre breakdown, weekly play patterns, average session length,
                and streaks. Understand how you spend your gaming time.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">
                Public Profile
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Share your gaming identity with a unique profile URL. Showcase
                your top games, total hours, and favourite genres.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA Banner ─── */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900 px-8 py-14 text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Ready to start tracking?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-zinc-400">
            Create a free account and download the tracker. Your gaming stats
            await.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-600 px-8 text-base font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-500"
            >
              Create Free Account
            </Link>
            <Link
              href="/download"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-zinc-700 px-8 text-base font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
            >
              Download Tracker
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-zinc-800/60 px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-white">
              Hesoyam
            </span>
          </div>

          <nav className="flex gap-6 text-sm text-zinc-400">
            <Link href="/download" className="transition-colors hover:text-white">
              Download
            </Link>
            <Link href="/login" className="transition-colors hover:text-white">
              Login
            </Link>
            <Link href="/signup" className="transition-colors hover:text-white">
              Sign Up
            </Link>
          </nav>

          <p className="text-sm text-zinc-500">
            &copy; {new Date().getFullYear()} Hesoyam. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
