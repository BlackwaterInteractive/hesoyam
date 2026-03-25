import Link from "next/link";

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ─── Navigation ─── */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="text-xl font-bold tracking-tight text-white">
            RAID
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:text-white"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Header ─── */}
      <section className="px-6 pt-20 pb-12 text-center sm:pt-28 sm:pb-16">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
          Download{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            RAID Tracker
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-400">
          A lightweight desktop agent that automatically tracks your gaming
          sessions and syncs them to your dashboard.
        </p>
      </section>

      {/* ─── Platform Cards ─── */}
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <div className="grid gap-6 sm:grid-cols-3">
          {/* Windows */}
          <div className="flex flex-col items-center border border-zinc-800 bg-zinc-900 p-8 text-center">
            {/* Windows icon */}
            <div className="flex h-16 w-16 items-center justify-center bg-zinc-800">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-sky-400"
              >
                <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
              </svg>
            </div>
            <h2 className="mt-5 text-lg font-semibold text-white">
              RAID for Windows
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Windows 10 or later. Runs silently in your system tray and
              automatically tracks game sessions.
            </p>
            <button
              disabled
              className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 bg-emerald-600/40 px-6 text-sm font-semibold text-emerald-200 cursor-not-allowed"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Coming Soon
            </button>
          </div>

          {/* macOS */}
          <div className="flex flex-col items-center border border-zinc-800 bg-zinc-900 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center bg-zinc-800">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-zinc-400"
              >
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
            </div>
            <h2 className="mt-5 text-lg font-semibold text-white">
              RAID for macOS
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Native macOS support is on the roadmap. Stay tuned for updates.
            </p>
            <div className="mt-6 flex h-11 w-full items-center justify-center border border-zinc-700 text-sm font-medium text-zinc-500">
              Coming Soon
            </div>
          </div>

          {/* Linux */}
          <div className="flex flex-col items-center border border-zinc-800 bg-zinc-900 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center bg-zinc-800">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-zinc-400"
              >
                <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 0 0-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.368 1.884 1.43.868.074 1.741-.313 2.452-.535.363-.11.684-.198.85-.26.461-.17.852-.33.983-.536.133-.199.166-.465.064-.735a.69.69 0 0 0-.104-.17c.1-.2.166-.397.2-.6.064-.335-.024-.715-.1-.915-.075-.2-.133-.4-.075-.6.175-.56.11-1.03-.046-1.36-.092-.2-.2-.334-.266-.399.374-.7.553-1.598.333-2.615-.227-1.015-.727-1.945-1.234-2.652-.507-.702-1.008-.975-1.517-1.52-.387-.4-.726-1.017-1.04-1.874-.314-.87-.568-1.99-.568-3.389l.003-.042c.083-2.116-.454-3.394-1.266-4.175-.818-.798-1.893-1.083-3.006-1.083zm-.5 1c.937.009 1.838.271 2.481.913.617.63 1.12 1.67 1.013 3.702l-.004.073c0 1.463.27 2.652.608 3.593.337.937.724 1.646 1.163 2.099.573.6 1.09.849 1.555 1.492.464.647.947 1.508 1.152 2.433.209.93.046 1.676-.267 2.26l-.032.047c.149.18.261.377.313.596.1.333.075.73-.042 1.14-.116.4.006.72.07.899.063.175.105.375.064.575-.052.244-.148.467-.3.674.02.058.037.117.052.175.06.254.006.455-.07.6-.076.145-.2.255-.4.345-.395.2-.97.333-1.368.474-.41.15-.83.283-1.21.354-.38.07-.84.066-1.22-.33l-.022-.027c-.628-.56-1.322-.873-2.163-.927-.778-.06-1.694.27-2.416.335-.746.065-1.276.058-1.667.03l-.037.092c-.173.394-.521.67-.94.759-.614.135-1.47-.05-2.345-.494-.958-.508-2.136-.517-2.84-.69-.352-.087-.606-.205-.707-.396-.1-.19-.06-.533.187-1.208.123-.328.067-.667.008-1.059-.057-.399-.087-.743-.032-.97a.49.49 0 0 1 .07-.155c.083-.133.222-.25.37-.35-.09-.774.042-1.573.3-2.358.567-1.7 1.762-3.354 2.608-4.367.686-.81.928-1.742 1.01-2.887.032-.57-.026-1.274-.013-2.054.013-.782.093-1.643.376-2.385.29-.744.738-1.373 1.467-1.71.49-.226 1.005-.343 1.508-.354z" />
              </svg>
            </div>
            <h2 className="mt-5 text-lg font-semibold text-white">
              RAID for Linux
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Linux support is on the roadmap. We will prioritize based on
              community demand.
            </p>
            <div className="mt-6 flex h-11 w-full items-center justify-center border border-zinc-700 text-sm font-medium text-zinc-500">
              Coming Soon
            </div>
          </div>
        </div>
      </section>

      {/* ─── System Requirements ─── */}
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <div className="border border-zinc-800 bg-zinc-900 p-8">
          <h2 className="text-lg font-semibold text-white">
            System Requirements
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            The RAID Tracker is designed to be lightweight and unobtrusive.
          </p>
          <ul className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center bg-emerald-600/10 text-emerald-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <span className="text-zinc-300">
                <strong className="font-medium text-white">OS:</strong> Windows
                10 or later (64-bit)
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center bg-emerald-600/10 text-emerald-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <span className="text-zinc-300">
                <strong className="font-medium text-white">Size:</strong>{" "}
                ~50&nbsp;MB installed
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center bg-emerald-600/10 text-emerald-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <span className="text-zinc-300">
                <strong className="font-medium text-white">Memory:</strong>{" "}
                Less than 30&nbsp;MB RAM while running
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center bg-emerald-600/10 text-emerald-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <span className="text-zinc-300">
                <strong className="font-medium text-white">Behaviour:</strong>{" "}
                Runs in the system tray, launches at startup
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* ─── Already Have Account ─── */}
      <section className="mx-auto max-w-4xl px-6 pb-20 text-center">
        <p className="text-zinc-400">
          Already have an account?{" "}
          <Link
            href="/dashboard"
            className="font-medium text-emerald-400 transition-colors hover:text-emerald-300"
          >
            Go to your dashboard
          </Link>
        </p>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-zinc-800/60 px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-white">
              RAID
            </span>
          </div>

          <nav className="flex gap-6 text-sm text-zinc-400">
            <Link href="/" className="transition-colors hover:text-white">
              Home
            </Link>
            <Link href="/login" className="transition-colors hover:text-white">
              Login
            </Link>
            <Link href="/signup" className="transition-colors hover:text-white">
              Sign Up
            </Link>
          </nav>

          <p className="text-sm text-zinc-500">
            &copy; {new Date().getFullYear()} RAID. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
