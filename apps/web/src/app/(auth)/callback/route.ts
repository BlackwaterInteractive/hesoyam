import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function waitForProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  retries = 5
) {
  for (let i = 0; i <= retries; i++) {
    const { data } = await supabase
      .from('profiles')
      .select('username, discord_id, password_set')
      .eq('id', userId)
      .single()

    if (data) return data
    if (i < retries) await new Promise((r) => setTimeout(r, 600))
  }
  return null
}

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
        // Detect Discord auth from any available metadata field
        const isDiscordAuth =
          user.app_metadata?.provider === 'discord' ||
          user.app_metadata?.providers?.includes('discord') ||
          user.identities?.some((i) => i.provider === 'discord')
        const discordId =
          user.user_metadata?.provider_id ||
          user.identities?.find((i) => i.provider === 'discord')?.id

        const profile = await waitForProfile(supabase, user.id)

        if (!profile) {
          return NextResponse.redirect(
            `${origin}/login?error=profile_creation_failed`
          )
        }

        // Sync Discord metadata to profile if not already set
        if (isDiscordAuth && discordId && !profile.discord_id) {
          await supabase
            .from('profiles')
            .update({
              discord_id: discordId,
              discord_connected_at: new Date().toISOString(),
              display_name:
                user.user_metadata?.custom_claims?.global_name ||
                user.user_metadata?.full_name ||
                user.user_metadata?.name ||
                null,
              avatar_url: user.user_metadata?.avatar_url || null,
            })
            .eq('id', user.id)
        }

        if (!profile.username) {
          return NextResponse.redirect(`${origin}/setup-username`)
        }

        if (!profile.password_set) {
          return NextResponse.redirect(`${origin}/setup-password`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // If code exchange fails, redirect to login with error
  return NextResponse.redirect(`${origin}/login`)
}
