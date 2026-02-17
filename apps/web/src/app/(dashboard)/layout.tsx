import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Check for authenticated session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // If no profile or no username set, redirect to setup
  if (!profile || !profile.username) {
    redirect('/setup-username')
  }

  const username = profile.username

  return (
    <div className="flex h-screen bg-zinc-950">
      <Sidebar
        username={username}
        displayName={profile.display_name}
        avatarUrl={profile.avatar_url}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          username={username}
          displayName={profile.display_name}
          avatarUrl={profile.avatar_url}
        />

        {!profile.in_guild && (
          <div className="flex items-center justify-between border-b border-amber-800/50 bg-amber-950/30 px-4 py-2.5 lg:px-8">
            <p className="text-sm text-amber-300/90">
              Join our Discord server to start tracking your gaming activity.
            </p>
            <a
              href="https://discord.gg/hesoyam"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-4 shrink-0 bg-[#5865F2] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#4752C4]"
            >
              Join Server
            </a>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
