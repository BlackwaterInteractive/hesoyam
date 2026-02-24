'use client'

import { useState, useTransition } from 'react'
import { addToLibrary, updateGameStatus, removeFromLibrary } from '@/app/(dashboard)/games/actions'
import type { GameStatus, UserGameLibrary } from '@/lib/types'
import { cn } from '@/lib/utils'

interface GameLibraryActionsProps {
  gameId: string
  libraryEntry: UserGameLibrary | null
}

const STATUS_OPTIONS: { value: GameStatus; label: string; color: string }[] = [
  { value: 'playing', label: 'Playing', color: 'border-emerald-700 bg-emerald-950 text-emerald-400 hover:bg-emerald-900' },
  { value: 'completed', label: 'Completed', color: 'border-green-700 bg-green-950 text-green-400 hover:bg-green-900' },
  { value: 'want_to_play', label: 'Want to Play', color: 'border-blue-700 bg-blue-950 text-blue-400 hover:bg-blue-900' },
  { value: 'shelved', label: 'Shelved', color: 'border-amber-700 bg-amber-950 text-amber-400 hover:bg-amber-900' },
  { value: 'dropped', label: 'Dropped', color: 'border-red-700 bg-red-950 text-red-400 hover:bg-red-900' },
]

export function GameLibraryActions({ gameId, libraryEntry }: GameLibraryActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [currentStatus, setCurrentStatus] = useState<GameStatus | null>(
    (libraryEntry?.status as GameStatus) ?? null
  )
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 3000)
  }

  function handleStatusChange(status: GameStatus) {
    if (status === currentStatus) return

    startTransition(async () => {
      let res: { success: boolean; error?: string }

      if (currentStatus === null) {
        res = await addToLibrary(gameId, status)
      } else {
        res = await updateGameStatus(gameId, status)
      }

      if (res.success) {
        setCurrentStatus(status)
        showFeedback('success', currentStatus === null ? 'Added to library!' : 'Status updated!')
      } else {
        showFeedback('error', res.error ?? 'Something went wrong.')
      }
    })
  }

  function handleRemove() {
    startTransition(async () => {
      const res = await removeFromLibrary(gameId)
      if (res.success) {
        setCurrentStatus(null)
        setShowRemoveConfirm(false)
        showFeedback('success', 'Removed from library.')
      } else {
        showFeedback('error', res.error ?? 'Something went wrong.')
      }
    })
  }

  return (
    <div className="border border-zinc-800 bg-zinc-900 p-6">
      <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
        {currentStatus !== null ? 'Library Status' : 'Add to Library'}
      </h3>

      {/* Feedback */}
      {feedback && (
        <div className={cn(
          'mb-4 px-3 py-2 text-sm',
          feedback.type === 'success'
            ? 'border border-emerald-800 bg-emerald-950 text-emerald-300'
            : 'border border-red-800 bg-red-950 text-red-300'
        )}>
          {feedback.message}
        </div>
      )}

      {/* Status buttons */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleStatusChange(opt.value)}
            disabled={isPending}
            className={cn(
              'border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50',
              currentStatus === opt.value
                ? opt.color
                : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Remove */}
      {currentStatus !== null && (
        <div className="mt-4 border-t border-zinc-800 pt-4">
          {showRemoveConfirm ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-400">Remove from library?</span>
              <button
                onClick={handleRemove}
                disabled={isPending}
                className="border border-red-800 bg-red-950 px-3 py-1 text-sm text-red-400 transition-colors hover:bg-red-900 disabled:opacity-50"
              >
                Yes, remove
              </button>
              <button
                onClick={() => setShowRemoveConfirm(false)}
                className="text-sm text-zinc-500 hover:text-zinc-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowRemoveConfirm(true)}
              className="text-sm text-zinc-500 transition-colors hover:text-red-400"
            >
              Remove from library
            </button>
          )}
        </div>
      )}
    </div>
  )
}
