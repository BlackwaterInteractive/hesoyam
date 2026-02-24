import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from '@/components/settings/profile-form'
import { DiscordConnection } from '@/components/settings/discord-connection'
import { TrackingStatus } from '@/components/settings/tracking-status'

export const metadata = {
  title: 'Settings - Hesoyam',
  description: 'Manage your Hesoyam profile and account settings.',
}

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Settings</h2>
        <p className="mt-1 text-zinc-500">
          Manage your profile, tracking methods, and account preferences.
        </p>
      </div>

      {/* Tracking Status */}
      <TrackingStatus profile={profile} />

      {/* Discord Connection */}
      <DiscordConnection profile={profile} />

      {/* Profile Form */}
      <ProfileForm profile={profile} email={user.email || ''} />
    </div>
  )
}
