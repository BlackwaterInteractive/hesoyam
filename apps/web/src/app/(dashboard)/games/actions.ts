'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { GameStatus } from '@/lib/types'

interface ActionResult {
  success: boolean
  error?: string
}

interface IgdbSearchResult {
  id: number
  name: string
  slug: string
  cover?: { id: number; image_id: string }
  genres?: { id: number; name: string }[]
  first_release_date?: number
}

export async function searchIgdb(query: string): Promise<{ results: IgdbSearchResult[]; error?: string }> {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    return { results: [], error: 'No active session.' }
  }

  const apiUrl = process.env.BACKEND_API_URL
  if (!apiUrl) {
    return { results: [], error: 'Backend API URL not configured.' }
  }

  try {
    const res = await fetch(`${apiUrl}/games/search?query=${encodeURIComponent(query)}&limit=10`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    })

    if (!res.ok) {
      return { results: [], error: 'IGDB search failed.' }
    }

    const data = await res.json()
    return { results: data as IgdbSearchResult[] }
  } catch {
    return { results: [], error: 'Failed to connect to backend API.' }
  }
}

export async function addToLibrary(gameId: string, status: GameStatus): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'You must be signed in.' }
  }

  const { error } = await supabase
    .from('user_game_library')
    .insert({ user_id: user.id, game_id: gameId, status })

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Game is already in your library.' }
    }
    return { success: false, error: 'Failed to add game to library.' }
  }

  revalidatePath('/games')
  return { success: true }
}

export async function updateGameStatus(gameId: string, status: GameStatus): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'You must be signed in.' }
  }

  const { error } = await supabase
    .from('user_game_library')
    .update({ status, status_changed_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('game_id', gameId)

  if (error) {
    return { success: false, error: 'Failed to update game status.' }
  }

  revalidatePath('/games')
  revalidatePath(`/games/${gameId}`)
  return { success: true }
}

export async function removeFromLibrary(gameId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'You must be signed in.' }
  }

  const { error } = await supabase
    .from('user_game_library')
    .delete()
    .eq('user_id', user.id)
    .eq('game_id', gameId)

  if (error) {
    return { success: false, error: 'Failed to remove game from library.' }
  }

  revalidatePath('/games')
  revalidatePath(`/games/${gameId}`)
  return { success: true }
}

export async function importAndAddToLibrary(igdbId: number, status: GameStatus): Promise<ActionResult & { gameId?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'You must be signed in.' }
  }

  // Get access token to call backend API (JWT auth)
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    return { success: false, error: 'No active session.' }
  }

  const apiUrl = process.env.BACKEND_API_URL
  if (!apiUrl) {
    return { success: false, error: 'Backend API URL not configured.' }
  }

  const res = await fetch(`${apiUrl}/games/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ igdbId }),
  })

  if (!res.ok) {
    return { success: false, error: 'Failed to import game from IGDB.' }
  }

  const data = await res.json()
  const gameId = data.id

  if (!gameId) {
    return { success: false, error: 'Failed to get game ID after import.' }
  }

  const { error } = await supabase
    .from('user_game_library')
    .insert({ user_id: user.id, game_id: gameId, status })

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Game is already in your library.' }
    }
    return { success: false, error: 'Failed to add game to library.' }
  }

  revalidatePath('/games')
  return { success: true, gameId }
}
