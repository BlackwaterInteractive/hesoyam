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

  return (
    <div className="flex h-screen bg-zinc-950">
      <Sidebar
        username={profile.username}
        displayName={profile.display_name}
        avatarUrl={profile.avatar_url}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          username={profile.username}
          displayName={profile.display_name}
          avatarUrl={profile.avatar_url}
        />

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
