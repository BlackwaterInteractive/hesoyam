import type { Metadata } from 'next'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { ProfileHeader } from '@/components/profile/profile-header'
import { TopGamesList, type TopGameEntry } from '@/components/profile/top-games-list'
import type { Game, UserGame } from '@/lib/types'

interface PageProps {
  params: Promise<{ username: string }>
}

async function getProfile(username: string) {
  const supabase = await createClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single()

  if (error || !profile) {
    return null
  }

  return profile
}

async function getTopGames(userId: string): Promise<TopGameEntry[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_games')
    .select('*, games(*)')
    .eq('user_id', userId)
    .order('total_time_secs', { ascending: false })
    .limit(10)

  if (error || !data) {
    return []
  }

  return data
    .filter((row: any) => row.games !== null)
    .map((row: any) => ({
      game: row.games as Game,
      userGame: {
        user_id: row.user_id,
        game_id: row.game_id,
        total_time_secs: row.total_time_secs,
        total_sessions: row.total_sessions,
        first_played: row.first_played,
        last_played: row.last_played,
        avg_session_secs: row.avg_session_secs,
      } as UserGame,
    }))
}

async function getCurrentlyPlaying(userId: string): Promise<string | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('game_sessions')
    .select('*, games(*)')
    .eq('user_id', userId)
    .is('ended_at', null)
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  // Handle Discord sessions (game_name but no game_id/games join)
  const session = data as any
  if (session.games?.name) {
    return session.games.name
  }
  if (session.game_name) {
    return session.game_name
  }
  return null
}

async function getTotalStats(userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_games')
    .select('total_time_secs, game_id')
    .eq('user_id', userId)

  if (error || !data) {
    return { totalHours: 0, totalGames: 0 }
  }

  const totalSecs = data.reduce((acc: number, row: any) => acc + (row.total_time_secs || 0), 0)
  return {
    totalHours: Math.round(totalSecs / 3600),
    totalGames: data.length,
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params
  const profile = await getProfile(username)

  if (!profile) {
    return {
      title: 'Profile Not Found - Hesoyam',
    }
  }

  const displayName = profile.display_name || profile.username
  const description = profile.bio
    ? `${displayName} on Hesoyam: ${profile.bio}`
    : `${displayName}'s gaming profile on Hesoyam. Track your game time and stats.`

  return {
    title: `${displayName} (@${profile.username}) - Hesoyam`,
    description,
    openGraph: {
      title: `${displayName} - Hesoyam`,
      description,
      type: 'profile',
      ...(profile.avatar_url && { images: [{ url: profile.avatar_url }] }),
    },
  }
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params
  const profile = await getProfile(username)

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-50">Profile Not Found</h1>
          <p className="mt-2 text-sm text-zinc-400">
            The user @{username} does not exist or their profile is unavailable.
          </p>
          <a
            href="/"
            className="mt-6 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
          >
            Go Home
          </a>
        </div>
      </div>
    )
  }

  if (profile.privacy === 'private') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900">
            <svg className="h-8 w-8 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-zinc-50">Private Profile</h1>
          <p className="mt-2 text-sm text-zinc-400">
            @{profile.username}&apos;s profile is private.
          </p>
          <a
            href="/"
            className="mt-6 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
          >
            Go Home
          </a>
        </div>
      </div>
    )
  }

  const [topGames, currentlyPlaying, stats] = await Promise.all([
    getTopGames(profile.id),
    getCurrentlyPlaying(profile.id),
    getTotalStats(profile.id),
  ])

  const memberSince = format(new Date(profile.created_at), 'MMM yyyy')

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Profile Header */}
        <ProfileHeader profile={profile} initialCurrentlyPlaying={currentlyPlaying} />

        {/* Stats Row */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
            <p className="text-2xl font-bold text-zinc-50">{stats.totalHours.toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-zinc-400">Hours Played</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
            <p className="text-2xl font-bold text-zinc-50">{stats.totalGames}</p>
            <p className="mt-0.5 text-xs text-zinc-400">Games</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
            <p className="text-2xl font-bold text-zinc-50">{memberSince}</p>
            <p className="mt-0.5 text-xs text-zinc-400">Member Since</p>
          </div>
        </div>

        {/* Top Games */}
        <div className="mt-8">
          <TopGamesList games={topGames} />
        </div>
      </div>
    </div>
  )
}
