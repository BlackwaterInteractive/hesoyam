'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SetupPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function loadEmail() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user?.email) {
        setEmail(user.email)
      }
    }
    loadEmail()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
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

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ password_set: true })
      .eq('id', user.id)

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    router.push('/join-server')
    router.refresh()
  }

  return (
    <div>
      <h2
        className="text-2xl font-bold text-white"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
      >
        Set a password
      </h2>
      <p className="mt-2 mb-8 text-sm text-zinc-500">
        You&apos;ll use this to sign in from the desktop app
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email (read-only) */}
        <div>
          <label htmlFor="email" className="block text-xs text-zinc-500 mb-2 uppercase tracking-widest">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            readOnly
            className="w-full border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-zinc-500 outline-none cursor-not-allowed"
          />
          <p className="mt-1.5 text-xs text-zinc-600">
            Linked to your Discord account
          </p>
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-xs text-zinc-500 mb-2 uppercase tracking-widest">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="At least 8 characters"
            className="w-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-white/20 focus:bg-white/[0.06]"
          />
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirm_password" className="block text-xs text-zinc-500 mb-2 uppercase tracking-widest">
            Confirm Password
          </label>
          <input
            id="confirm_password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Re-enter your password"
            className="w-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-white/20 focus:bg-white/[0.06]"
          />
        </div>

        {error && (
          <div className="border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || password.length < 8}
          className="w-full bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="inline-flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
