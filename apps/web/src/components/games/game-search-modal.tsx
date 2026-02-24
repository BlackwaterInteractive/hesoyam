'use client'

import { useState, useEffect, useRef, useTransition, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addToLibrary, importAndAddToLibrary } from '@/app/(dashboard)/games/actions'
import type { GameStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

interface SearchResult {
  id?: string
  igdb_id?: number
  name: string
  cover_url: string | null
  release_year?: number | null
  genres?: string[] | null
  source: 'local' | 'igdb'
}

interface GameSearchModalProps {
  open: boolean
  onClose: () => void
  libraryGameIds: Set<string>
}

const STATUS_OPTIONS: { value: GameStatus; label: string }[] = [
  { value: 'want_to_play', label: 'Want to Play' },
  { value: 'playing', label: 'Playing' },
  { value: 'completed', label: 'Completed' },
  { value: 'shelved', label: 'Shelved' },
  { value: 'dropped', label: 'Dropped' },
]

export function GameSearchModal({ open, onClose, libraryGameIds }: GameSearchModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchingIgdb, setSearchingIgdb] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [addingId, setAddingId] = useState<string | null>(null)
  const [statusPickerFor, setStatusPickerFor] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const abortRef = useRef(0)

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSearching(false)
      setSearchingIgdb(false)
      setFeedback(null)
      setStatusPickerFor(null)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const search = useCallback(async (term: string) => {
    const searchId = ++abortRef.current

    if (term.length < 2) {
      setResults([])
      setSearching(false)
      setSearchingIgdb(false)
      return
    }

    setSearching(true)
    setSearchingIgdb(true)

    const supabase = createClient()

    // Step 1: Local search — show results immediately
    const localData = await supabase.rpc('search_games_library', { search_term: term })

    if (abortRef.current !== searchId) return

    const localResults: SearchResult[] = (localData.data ?? []).map((g: any) => ({
      id: g.id,
      igdb_id: g.igdb_id ?? undefined,
      name: g.name,
      cover_url: g.cover_url,
      release_year: g.release_year,
      genres: g.genres,
      source: 'local' as const,
    }))

    setResults(localResults)
    setSearching(false)

    // Step 2: IGDB search — append results when they arrive
    const igdbData = await supabase.functions.invoke('igdb-search', { body: { query: term } })

    if (abortRef.current !== searchId) return

    const igdbResults: any[] = igdbData.data?.results ?? []

    // Deduplicate by igdb_id: collect igdb_ids from local results
    const localIgdbIds = new Set(
      localResults.filter((r) => r.igdb_id).map((r) => r.igdb_id)
    )

    const igdbMapped: SearchResult[] = igdbResults
      .filter((r: any) => !localIgdbIds.has(r.igdb_id))
      .map((r: any) => ({
        igdb_id: r.igdb_id,
        name: r.name,
        cover_url: r.cover_url,
        release_year: r.release_year,
        genres: r.genres,
        source: 'igdb' as const,
      }))

    if (abortRef.current !== searchId) return
    setResults([...localResults, ...igdbMapped])
    setSearchingIgdb(false)
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)

    if (query.trim().length >= 2) {
      debounceRef.current = setTimeout(() => search(query.trim()), 200)
    } else {
      abortRef.current++
      setResults([])
      setSearching(false)
      setSearchingIgdb(false)
    }

    return () => clearTimeout(debounceRef.current)
  }, [query, search])

  function handleAdd(result: SearchResult, status: GameStatus) {
    const key = result.id ?? `igdb-${result.igdb_id}`
    setAddingId(key)
    setStatusPickerFor(null)

    startTransition(async () => {
      let res: { success: boolean; error?: string }

      if (result.source === 'local' && result.id) {
        res = await addToLibrary(result.id, status)
      } else if (result.igdb_id) {
        res = await importAndAddToLibrary(result.igdb_id, status)
      } else {
        res = { success: false, error: 'Invalid game data.' }
      }

      if (res.success) {
        setFeedback({ type: 'success', message: `${result.name} added to library!` })
        setResults((prev) => prev.filter((r) =>
          r.id ? r.id !== result.id : r.igdb_id !== result.igdb_id
        ))
      } else {
        setFeedback({ type: 'error', message: res.error ?? 'Something went wrong.' })
      }
      setAddingId(null)
      setTimeout(() => setFeedback(null), 3000)
    })
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', onKeyDown)
      return () => document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60" />
      <div
        className="relative z-10 w-full max-w-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="border-b border-zinc-800 p-4">
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search for a game..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full border border-zinc-700 bg-zinc-800 py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div className={cn(
            'mx-4 mt-3 px-3 py-2 text-sm',
            feedback.type === 'success' ? 'border border-emerald-800 bg-emerald-950 text-emerald-300' : 'border border-red-800 bg-red-950 text-red-300'
          )}>
            {feedback.message}
          </div>
        )}

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto p-4">
          {searching && results.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-500">Searching...</p>
          )}

          {!searching && !searchingIgdb && query.length >= 2 && results.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-500">No results found.</p>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              {searchingIgdb && (
                <p className="mb-2 text-xs text-zinc-500">Loading more results...</p>
              )}
              {results.map((result) => {
                const key = result.id ?? `igdb-${result.igdb_id}`
                const inLibrary = result.id ? libraryGameIds.has(result.id) : false
                const isAdding = addingId === key

                return (
                  <div key={key} className="flex items-center gap-3 border border-zinc-800 bg-zinc-950 p-3">
                    {/* Cover */}
                    <div className="h-14 w-10 shrink-0 overflow-hidden bg-zinc-800">
                      {result.cover_url ? (
                        <img src={result.cover_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-bold text-zinc-600">
                          {result.name.charAt(0)}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-100">{result.name}</p>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        {result.release_year && <span>{result.release_year}</span>}
                        {result.genres && result.genres.length > 0 && (
                          <span>{result.genres.slice(0, 2).join(', ')}</span>
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    <div className="relative shrink-0">
                      {inLibrary ? (
                        <span className="text-xs text-zinc-500">In Library</span>
                      ) : isAdding ? (
                        <span className="text-xs text-zinc-400">Adding...</span>
                      ) : statusPickerFor === key ? (
                        <div className="flex flex-wrap gap-1">
                          {STATUS_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => handleAdd(result, opt.value)}
                              className="border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 transition-colors hover:border-emerald-600 hover:text-emerald-400"
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <button
                          onClick={() => setStatusPickerFor(key)}
                          className="border border-emerald-700 bg-emerald-950 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-900"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 px-4 py-3 text-right">
          <button
            onClick={onClose}
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
