import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const isDiscordAuth =
          user.app_metadata?.provider === 'discord' ||
          user.app_metadata?.providers?.includes('discord')
        const discordId = user.user_metadata?.provider_id

        if (isDiscordAuth && discordId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, discord_id')
            .eq('id', user.id)
            .single()

          // Sync Discord metadata to profile if not already set
          if (profile && !profile.discord_id) {
            await supabase
              .from('profiles')
              .update({
                discord_id: discordId,
                discord_connected_at: new Date().toISOString(),
                display_name:
                  user.user_metadata?.global_name ||
                  user.user_metadata?.full_name ||
                  user.user_metadata?.name ||
                  null,
                avatar_url: user.user_metadata?.avatar_url || null,
              })
              .eq('id', user.id)
          }

          // Redirect to setup-username if no username yet
          if (!profile || !profile.username) {
            return NextResponse.redirect(`${origin}/setup-username`)
          }
        } else {
          // Non-Discord auth fallback: check username
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single()

          if (!profile || !profile.username) {
            return NextResponse.redirect(`${origin}/setup-username`)
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // If code exchange fails, redirect to login with error
  return NextResponse.redirect(`${origin}/login`)
}
