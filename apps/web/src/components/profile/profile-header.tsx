import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/types'

function getInitials(profile: Profile): string {
  const name = profile.display_name || profile.username
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

interface ProfileHeaderProps {
  profile: Profile
  currentlyPlaying?: string | null
  className?: string
}

export function ProfileHeader({ profile, currentlyPlaying, className }: ProfileHeaderProps) {
  const initials = getInitials(profile)

  return (
    <div className={cn('flex items-start gap-5', className)}>
      {/* Avatar */}
      <div className="relative shrink-0">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.display_name || profile.username}
            className="h-20 w-20 rounded-full object-cover ring-2 ring-zinc-800"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 ring-2 ring-zinc-800">
            <span className="text-xl font-bold text-white">{initials}</span>
          </div>
        )}
        {currentlyPlaying && (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-zinc-950">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          </span>
        )}
      </div>

      {/* Name and info */}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold text-zinc-50">
          {profile.display_name || profile.username}
        </h1>
        <p className="text-sm text-zinc-400">@{profile.username}</p>

        {currentlyPlaying && (
          <p className="mt-1.5 text-sm text-emerald-400">
            Currently playing {currentlyPlaying}
          </p>
        )}

        {profile.bio && (
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            {profile.bio}
          </p>
        )}
      </div>
    </div>
  )
}
