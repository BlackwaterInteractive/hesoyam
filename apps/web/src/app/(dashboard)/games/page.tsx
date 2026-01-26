import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GameGrid, type GameWithStats } from '@/components/games/game-grid'

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

  const { data: userGames, error } = await supabase
    .from('user_games')
    .select('*, games(*)')
    .eq('user_id', user.id)
    .order('last_played', { ascending: false })

  if (error) {
    console.error('Failed to fetch user games:', error)
  }

  const games: GameWithStats[] = (userGames ?? [])
    .filter((ug: any) => ug.games)
    .map((ug: any) => ({
      game: ug.games,
      userGame: {
        user_id: ug.user_id,
        game_id: ug.game_id,
        total_time_secs: ug.total_time_secs,
        total_sessions: ug.total_sessions,
        first_played: ug.first_played,
        last_played: ug.last_played,
        avg_session_secs: ug.avg_session_secs,
      },
    }))

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
            My Games
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            {games.length > 0
              ? `Tracking ${games.length} ${games.length === 1 ? 'game' : 'games'}`
              : 'Your game library will appear here once you start tracking.'}
          </p>
        </div>

        {/* Content */}
        {games.length > 0 ? (
          <GameGrid games={games} />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 py-24">
            <svg
              className="mb-6 h-16 w-16 text-zinc-700"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 0 0-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 0 1-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 0 0 5.427-.63 48.05 48.05 0 0 0 .582-4.717.532.532 0 0 0-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 0 0 .658-.663 48.422 48.422 0 0 0-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 0 1-.61-.58v0Z"
              />
            </svg>
            <h2 className="mb-2 text-lg font-semibold text-zinc-300">
              No games tracked yet
            </h2>
            <p className="max-w-sm text-center text-sm text-zinc-500">
              Install the Hesoyam desktop client and start playing. Your games
              will automatically appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
