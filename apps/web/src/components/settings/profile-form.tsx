'use client'

import { useState, useRef, useTransition, useCallback, type FormEvent, type ChangeEvent } from 'react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { updateProfile, signOut } from '@/app/(dashboard)/settings/actions'
import type { Profile } from '@/lib/types'

interface ProfileFormProps {
  profile: Profile
  email: string
}

function getInitials(profile: Profile): string {
  const name = profile.display_name || profile.username
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function ProfileForm({ profile, email }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(profile.display_name || '')
  const [username, setUsername] = useState(profile.username)
  const [bio, setBio] = useState(profile.bio || '')
  const [privacy, setPrivacy] = useState<Profile['privacy']>(profile.privacy)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const usernameTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null)

  const checkUsernameAvailability = useCallback(
    (value: string) => {
      if (usernameTimeoutRef.current) {
        clearTimeout(usernameTimeoutRef.current)
      }

      if (value === profile.username) {
        setUsernameStatus('idle')
        return
      }

      if (value.length < 3 || !/^[a-zA-Z0-9_-]+$/.test(value)) {
        setUsernameStatus('idle')
        return
      }

      setUsernameStatus('checking')

      usernameTimeoutRef.current = setTimeout(async () => {
        const supabase = createClient()
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', value)
          .neq('id', profile.id)
          .single()

        setUsernameStatus(data ? 'taken' : 'available')
      }, 500)
    },
    [profile.username, profile.id]
  )

  function handleUsernameChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')
    setUsername(value)
    checkUsernameAvailability(value)
  }

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      setToast({ type: 'error', message: 'Avatar must be smaller than 2MB.' })
      return
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setToast({ type: 'error', message: 'Avatar must be a JPEG, PNG, or WebP image.' })
      return
    }

    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setToast(null)

    const formData = new FormData()
    formData.set('display_name', displayName)
    formData.set('username', username)
    formData.set('bio', bio)
    formData.set('privacy', privacy)

    if (avatarFile) {
      formData.set('avatar', avatarFile)
    }

    startTransition(async () => {
      const result = await updateProfile(formData)
      if (result.success) {
        setToast({ type: 'success', message: 'Profile updated successfully.' })
        setAvatarFile(null)
      } else {
        setToast({ type: 'error', message: result.error || 'Something went wrong.' })
      }
    })
  }

  function handleSignOut() {
    setIsSigningOut(true)
    startTransition(async () => {
      await signOut()
    })
  }

  const initials = getInitials(profile)

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'rounded-lg border px-4 py-3 text-sm',
            toast.type === 'success'
              ? 'border-emerald-800 bg-emerald-950 text-emerald-300'
              : 'border-red-800 bg-red-950 text-red-300'
          )}
        >
          {toast.message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Profile Section */}
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold text-zinc-100">Profile</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Your public profile information.
          </p>

          <div className="mt-6 space-y-5">
            {/* Avatar */}
            <div>
              <label className="block text-sm font-medium text-zinc-300">Avatar</label>
              <div className="mt-2 flex items-center gap-4">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar preview"
                    className="h-16 w-16 rounded-full object-cover ring-2 ring-zinc-700"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 ring-2 ring-zinc-700">
                    <span className="text-lg font-bold text-white">{initials}</span>
                  </div>
                )}
                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
                  >
                    Change Avatar
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  <p className="mt-1 text-xs text-zinc-500">JPEG, PNG, or WebP. Max 2MB.</p>
                </div>
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label htmlFor="display_name" className="block text-sm font-medium text-zinc-300">
                Display Name
              </label>
              <input
                id="display_name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                placeholder="Your display name"
                className="mt-1.5 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-zinc-300">
                Username
              </label>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-zinc-500">
                  @
                </span>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={handleUsernameChange}
                  minLength={3}
                  maxLength={30}
                  required
                  className="block w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-7 pr-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              {usernameStatus === 'checking' && (
                <p className="mt-1 text-xs text-zinc-400">Checking availability...</p>
              )}
              {usernameStatus === 'available' && (
                <p className="mt-1 text-xs text-emerald-400">Username is available.</p>
              )}
              {usernameStatus === 'taken' && (
                <p className="mt-1 text-xs text-red-400">Username is already taken.</p>
              )}
            </div>

            {/* Bio */}
            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-zinc-300">
                Bio
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={300}
                rows={3}
                placeholder="Tell others about yourself..."
                className="mt-1.5 block w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <p className="mt-1 text-right text-xs text-zinc-500">
                {bio.length}/300
              </p>
            </div>
          </div>
        </section>

        {/* Privacy Section */}
        <section className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold text-zinc-100">Privacy</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Control who can see your profile and gaming activity.
          </p>

          <fieldset className="mt-5 space-y-3">
            <legend className="sr-only">Profile visibility</legend>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-800/50 p-3 transition-colors hover:bg-zinc-800">
              <input
                type="radio"
                name="privacy"
                value="public"
                checked={privacy === 'public'}
                onChange={() => setPrivacy('public')}
                className="mt-0.5 h-4 w-4 accent-emerald-500"
              />
              <div>
                <p className="text-sm font-medium text-zinc-200">Public</p>
                <p className="text-xs text-zinc-400">Anyone can view your profile and game stats.</p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-800/50 p-3 transition-colors hover:bg-zinc-800">
              <input
                type="radio"
                name="privacy"
                value="friends_only"
                checked={privacy === 'friends_only'}
                onChange={() => setPrivacy('friends_only')}
                className="mt-0.5 h-4 w-4 accent-emerald-500"
              />
              <div>
                <p className="text-sm font-medium text-zinc-200">Friends Only</p>
                <p className="text-xs text-zinc-400">Only your friends can view your profile.</p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-800/50 p-3 transition-colors hover:bg-zinc-800">
              <input
                type="radio"
                name="privacy"
                value="private"
                checked={privacy === 'private'}
                onChange={() => setPrivacy('private')}
                className="mt-0.5 h-4 w-4 accent-emerald-500"
              />
              <div>
                <p className="text-sm font-medium text-zinc-200">Private</p>
                <p className="text-xs text-zinc-400">Your profile is hidden from everyone.</p>
              </div>
            </label>
          </fieldset>
        </section>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={isPending || usernameStatus === 'taken'}
            className={cn(
              'rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors',
              isPending || usernameStatus === 'taken'
                ? 'cursor-not-allowed bg-emerald-800 opacity-50'
                : 'bg-emerald-600 hover:bg-emerald-500'
            )}
          >
            {isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* Account Section */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold text-zinc-100">Account</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Your account information and actions.
        </p>

        <div className="mt-5 space-y-4">
          {/* Email (read-only) */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              readOnly
              className="mt-1.5 block w-full cursor-not-allowed rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-400 outline-none"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Your email cannot be changed here.
            </p>
          </div>

          {/* Sign Out */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSigningOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
