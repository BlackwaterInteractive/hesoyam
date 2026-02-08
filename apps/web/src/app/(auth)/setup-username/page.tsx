'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/

export default function SetupUsernamePage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)

  // Pre-fill from Discord metadata
  useEffect(() => {
    async function loadDiscordData() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const meta = user.user_metadata
      if (!meta) return

      // Pre-fill display name
      const name = meta.global_name || meta.full_name || meta.name || ''
      setDisplayName(name)

      // Pre-fill avatar
      if (meta.avatar_url) {
        setAvatarUrl(meta.avatar_url)
      }

      // Suggest username from Discord username (lowercase, special chars removed)
      const discordUsername = meta.custom_claims?.global_name || meta.preferred_username || meta.name || ''
      if (discordUsername) {
        const suggested = discordUsername
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '')
          .slice(0, 20)
        if (suggested.length >= 3) {
          setUsername(suggested)
        }
      }
    }
    loadDiscordData()
  }, [])

  const validateFormat = (value: string): string | null => {
    if (value.length < 3) return 'Username must be at least 3 characters'
    if (value.length > 20) return 'Username must be at most 20 characters'
    if (!/^[a-z0-9_]+$/.test(value))
      return 'Only lowercase letters, numbers, and underscores allowed'
    return null
  }

  const checkAvailability = useCallback(
    async (value: string) => {
      if (!USERNAME_REGEX.test(value)) {
        setAvailable(null)
        return
      }

      setChecking(true)
      const supabase = createClient()

      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', value)
        .maybeSingle()

      setAvailable(!data)
      setChecking(false)
    },
    []
  )

  function handleUsernameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
    setUsername(value)
    setError(null)
    setAvailable(null)

    if (value.length >= 3) {
      const timeout = setTimeout(() => checkAvailability(value), 400)
      return () => clearTimeout(timeout)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const formatError = validateFormat(username)
    if (formatError) {
      setError(formatError)
      return
    }

    if (available === false) {
      setError('Username is already taken')
      return
    }

    setLoading(true)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be signed in')
      setLoading(false)
      return
    }

    const updateData: Record<string, string | null> = { username }
    if (displayName.trim()) {
      updateData.display_name = displayName.trim()
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)

    if (updateError) {
      if (updateError.code === '23505') {
        setError('Username is already taken')
        setAvailable(false)
      } else {
        setError(updateError.message)
      }
      setLoading(false)
      return
    }

    router.push('/join-server')
    router.refresh()
  }

  const showStatus = username.length >= 3 && !error

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-1">Set up your profile</h2>
      <p className="text-sm text-zinc-400 mb-6">
        Choose a username and confirm your display name
      </p>

      {/* Discord avatar preview */}
      {avatarUrl && (
        <div className="flex justify-center mb-6">
          <img
            src={avatarUrl}
            alt="Discord avatar"
            className="h-20 w-20 rounded-full border-2 border-zinc-700"
          />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Display Name */}
        <div>
          <label
            htmlFor="display_name"
            className="block text-sm font-medium text-zinc-300 mb-1.5"
          >
            Display Name
          </label>
          <input
            id="display_name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={50}
            placeholder="Your display name"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
          <p className="mt-1.5 text-xs text-zinc-500">
            Pre-filled from your Discord profile. You can change it.
          </p>
        </div>

        {/* Username */}
        <div>
          <label
            htmlFor="username"
            className="block text-sm font-medium text-zinc-300 mb-1.5"
          >
            Username
          </label>
          <div className="relative">
            <input
              id="username"
              type="text"
              value={username}
              onChange={handleUsernameChange}
              required
              maxLength={20}
              placeholder="cool_gamer"
              autoComplete="off"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
            {showStatus && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {checking ? (
                  <svg
                    className="h-5 w-5 animate-spin text-zinc-400"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : available === true ? (
                  <svg
                    className="h-5 w-5 text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ) : available === false ? (
                  <svg
                    className="h-5 w-5 text-red-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ) : null}
              </div>
            )}
          </div>

          {showStatus && !checking && available === true && (
            <p className="mt-1.5 text-xs text-emerald-400">
              Username is available
            </p>
          )}
          {showStatus && !checking && available === false && (
            <p className="mt-1.5 text-xs text-red-400">
              Username is already taken
            </p>
          )}

          <p className="mt-1.5 text-xs text-zinc-500">
            3-20 characters. Lowercase letters, numbers, and underscores only.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || checking || available === false || username.length < 3}
          className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Saving...
            </span>
          ) : (
            'Continue'
          )}
        </button>
      </form>
    </div>
  )
}
