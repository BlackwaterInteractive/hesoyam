import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { formatDuration } from '@/lib/utils'
import { GameDetailStats } from '@/components/games/game-detail-stats'
import { GameLibraryActions } from '@/components/games/game-library-actions'
import type { Game, UserGame, UserGameLibrary, GameSession } from '@/lib/types'

interface GameDetailPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: GameDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: game } = await supabase
    .from('games')
    .select('name')
    .eq('id', id)
    .single()

  return {
    title: game ? `${game.name} - RAID` : 'Game - RAID',
  }
}

export default async function GameDetailPage({ params }: GameDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch game info
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('id', id)
    .single()

  if (gameError || !game) {
    notFound()
  }

  // Fetch user_games stats
  const { data: userGame } = await supabase
    .from('user_games')
    .select('*')
    .eq('user_id', user.id)
    .eq('game_id', id)
    .single()

  // Fetch library entry
  const { data: libraryEntry } = await supabase
    .from('user_game_library')
    .select('*')
    .eq('user_id', user.id)
    .eq('game_id', id)
    .single()

  // Fetch recent sessions (last 30 days worth, up to 100)
  const { data: sessions } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('game_id', id)
    .order('started_at', { ascending: false })
    .limit(100)

  const typedGame = game as Game
  const typedUserGame = userGame as UserGame | null
  const typedLibraryEntry = libraryEntry as UserGameLibrary | null
  const typedSessions = (sessions ?? []) as GameSession[]

  const initial = typedGame.name.charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-8">
          <Link
            href="/games"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-emerald-400"
          >
            <svg
              className="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
              />
            </svg>
            Back to My Games
          </Link>
        </nav>

        {/* Game header */}
        <div className="mb-10 flex flex-col gap-8 sm:flex-row">
          {/* Cover */}
          <div className="w-full shrink-0 sm:w-48">
            <div className="aspect-[3/4] w-full overflow-hidden ">
              {typedGame.cover_url ? (
                <img
                  src={typedGame.cover_url}
                  alt={typedGame.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-600 to-emerald-900">
                  <span className="text-6xl font-bold text-white/80">
                    {initial}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex flex-1 flex-col justify-center">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
              {typedGame.name}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-400">
              {typedGame.developer && (
                <span className="flex items-center gap-1.5">
                  <svg
                    className="h-4 w-4 text-zinc-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
                    />
                  </svg>
                  {typedGame.developer}
                </span>
              )}
              {typedGame.publisher && (
                <span className="flex items-center gap-1.5">
                  <svg
                    className="h-4 w-4 text-zinc-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21"
                    />
                  </svg>
                  {typedGame.publisher}
                </span>
              )}
              {typedGame.release_year && (
                <span className="flex items-center gap-1.5">
                  <svg
                    className="h-4 w-4 text-zinc-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                    />
                  </svg>
                  {typedGame.release_year}
                </span>
              )}
              {typedGame.rating && (
                <span className="flex items-center gap-1.5">
                  <svg
                    className="h-4 w-4 text-zinc-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
                    />
                  </svg>
                  {Math.round(typedGame.rating)}/100
                </span>
              )}
            </div>

            {/* Genres */}
            {typedGame.genres && typedGame.genres.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {typedGame.genres.map((genre) => (
                  <span
                    key={genre}
                    className="border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {/* Platforms */}
            {typedGame.platforms && typedGame.platforms.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {typedGame.platforms.map((platform) => (
                  <span
                    key={platform}
                    className="border border-zinc-800 px-2 py-0.5 text-xs text-zinc-500"
                  >
                    {platform}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Library actions */}
        <div className="mb-8">
          <GameLibraryActions gameId={id} libraryEntry={typedLibraryEntry} />
        </div>

        {/* Description */}
        {typedGame.description && (
          <div className="mb-8 border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="mb-3 text-lg font-semibold text-zinc-100">About</h3>
            <p className="text-sm leading-relaxed text-zinc-400">
              {typedGame.description}
            </p>
          </div>
        )}

        {/* Stats and chart */}
        {typedUserGame && (
          <GameDetailStats
            game={typedGame}
            userGame={typedUserGame}
            sessions={typedSessions}
          />
        )}

        {/* Screenshots */}
        {typedGame.screenshots && typedGame.screenshots.length > 0 && (
          <div className="mt-8 border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="mb-4 text-lg font-semibold text-zinc-100">Screenshots</h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {typedGame.screenshots.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`${typedGame.name} screenshot ${i + 1}`}
                  className="h-48 shrink-0 object-cover"
                />
              ))}
            </div>
          </div>
        )}

        {/* Recent sessions table */}
        {typedSessions.length > 0 && (
          <div className="mt-8 border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="mb-6 text-lg font-semibold text-zinc-100">
              Recent Sessions
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="pb-3 pr-6 font-medium text-zinc-400">
                      Date
                    </th>
                    <th className="pb-3 pr-6 font-medium text-zinc-400">
                      Duration
                    </th>
                    <th className="pb-3 pr-6 font-medium text-zinc-400">
                      Active Time
                    </th>
                    <th className="pb-3 font-medium text-zinc-400">
                      Idle Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {typedSessions.map((session) => (
                    <tr
                      key={session.id}
                      className="border-b border-zinc-800/50 last:border-0"
                    >
                      <td className="py-3 pr-6 text-zinc-300">
                        {format(
                          new Date(session.started_at),
                          'MMM d, yyyy h:mm a'
                        )}
                      </td>
                      <td className="py-3 pr-6 font-medium text-zinc-100">
                        {formatDuration(session.duration_secs)}
                      </td>
                      <td className="py-3 pr-6 text-emerald-400">
                        {formatDuration(session.active_secs)}
                      </td>
                      <td className="py-3 text-zinc-500">
                        {formatDuration(session.idle_secs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
