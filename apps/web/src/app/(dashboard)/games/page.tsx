import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GameGrid, type GameWithStats } from '@/components/games/game-grid'
import type { GameStatus } from '@/lib/types'

export const metadata = {
  title: 'My Games - Hesoyam',
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
        notes: entry.notes,
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
    <div className="min-h-screen bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
              My Games
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              {games.length > 0
                ? `${games.length} ${games.length === 1 ? 'game' : 'games'} in your library`
                : 'Your game library will appear here once you start tracking or add games.'}
            </p>
          </div>
        </div>

        {/* Content */}
        <GameGrid
          games={games}
          statusCounts={statusCounts}
          libraryGameIds={libraryGameIds}
          currentlyPlayingGameIds={currentlyPlayingGameIds}
        />
      </div>
    </div>
  )
}
