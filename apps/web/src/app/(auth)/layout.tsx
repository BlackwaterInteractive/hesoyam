export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Branding */}
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white">
            HESOYAM
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Track your game time. Own your stats.
          </p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl shadow-black/20">
          {children}
        </div>
      </div>
    </div>
  )
}
