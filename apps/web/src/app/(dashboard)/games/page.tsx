import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { type GameWithStats } from '@/components/games/game-grid'
import { LibraryView } from '@/components/library/library-view'
import type { GameStatus } from '@/lib/types'

export const metadata = {
  title: 'My Games - RAID',
}

export default async function GamesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch library entries, user_games stats, and recent sessions in parallel
  const [libraryResult, userGamesResult, recentSessionsResult] = await Promise.all([
    supabase
      .from('user_game_library')
      .select('*, games(*)')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false }),
    supabase
      .from('user_games')
      .select('*')
      .eq('user_id', user.id),
    supabase
      .from('game_sessions')
      .select('game_id')
      .eq('user_id', user.id)
      .not('game_id', 'is', null)
      .order('started_at', { ascending: false })
      .limit(20),
  ])

  if (libraryResult.error) {
    console.error('Failed to fetch library:', libraryResult.error)
  }

  // Derive "Now Playing" — first 3 distinct game_ids from recent sessions
  const currentlyPlayingGameIds = new Set<string>()
  for (const session of recentSessionsResult.data ?? []) {
    if (session.game_id && currentlyPlayingGameIds.size < 3) {
      currentlyPlayingGameIds.add(session.game_id)
    }
  }

  // Index user_games by game_id for quick lookup
  const userGamesMap = new Map(
    (userGamesResult.data ?? []).map((ug: any) => [ug.game_id, ug])
  )

  const games: GameWithStats[] = (libraryResult.data ?? [])
    .filter((entry: any) => entry.games)
    .map((entry: any) => ({
      game: entry.games,
      userGame: userGamesMap.get(entry.game_id) ?? null,
      libraryEntry: {
        id: entry.id,
        user_id: entry.user_id,
        game_id: entry.game_id,
        status: entry.status,
        personal_rating: entry.personal_rating,
        added_at: entry.added_at,
        status_changed_at: entry.status_changed_at,
      },
    }))

  // Compute status counts
  const statusCounts: Record<GameStatus, number> = {
    want_to_play: 0,
    played: 0,
    completed: 0,
  }
  for (const g of games) {
    statusCounts[g.libraryEntry.status as GameStatus]++
  }

  const libraryGameIds = games.map((g) => g.game.id)

  return (
    <div>
      <LibraryView games={games} />
    </div>
  )
}
