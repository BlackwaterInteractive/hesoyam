import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'

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
    <div className="flex h-screen bg-[#111111]">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top divider aligned with sidebar's divider */}
        <div className="h-px w-full bg-[#282828]" style={{ marginTop: 'calc(32px + 36px + 32px)' }} />

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
