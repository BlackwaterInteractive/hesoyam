'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

interface UpdateProfileResult {
  success: boolean
  error?: string
}

export async function updateProfile(formData: FormData): Promise<UpdateProfileResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'You must be signed in to update your profile.' }
  }

  const displayName = (formData.get('display_name') as string)?.trim() || null
  const username = (formData.get('username') as string)?.trim()
  const bio = (formData.get('bio') as string)?.trim() || null
  const privacy = formData.get('privacy') as 'public' | 'friends_only' | 'private'

  // Validate username
  if (!username || username.length < 3) {
    return { success: false, error: 'Username must be at least 3 characters.' }
  }

  if (username.length > 30) {
    return { success: false, error: 'Username must be 30 characters or fewer.' }
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { success: false, error: 'Username can only contain letters, numbers, hyphens, and underscores.' }
  }

  // Validate display name
  if (displayName && displayName.length > 50) {
    return { success: false, error: 'Display name must be 50 characters or fewer.' }
  }

  // Validate bio
  if (bio && bio.length > 300) {
    return { success: false, error: 'Bio must be 300 characters or fewer.' }
  }

  // Validate privacy
  if (!['public', 'friends_only', 'private'].includes(privacy)) {
    return { success: false, error: 'Invalid privacy setting.' }
  }

  // Check username availability if changed
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  if (currentProfile && currentProfile.username !== username) {
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .neq('id', user.id)
      .single()

    if (existing) {
      return { success: false, error: 'That username is already taken.' }
    }
  }

  // Handle avatar upload
  const avatarFile = formData.get('avatar') as File | null
  let avatarUrl: string | undefined

  if (avatarFile && avatarFile.size > 0) {
    if (avatarFile.size > 2 * 1024 * 1024) {
      return { success: false, error: 'Avatar must be smaller than 2MB.' }
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(avatarFile.type)) {
      return { success: false, error: 'Avatar must be a JPEG, PNG, or WebP image.' }
    }

    const ext = avatarFile.name.split('.').pop() || 'jpg'
    const filePath = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, avatarFile, { upsert: true })

    if (uploadError) {
      return { success: false, error: 'Failed to upload avatar. Please try again.' }
    }

    const { data: publicUrl } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    avatarUrl = publicUrl.publicUrl
  }

  // Update profile
  const updateData: Record<string, unknown> = {
    display_name: displayName,
    username,
    bio,
    privacy,
    updated_at: new Date().toISOString(),
  }

  if (avatarUrl) {
    updateData.avatar_url = avatarUrl
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', user.id)

  if (updateError) {
    if (updateError.code === '23505') {
      return { success: false, error: 'That username is already taken.' }
    }
    return { success: false, error: 'Failed to update profile. Please try again.' }
  }

  revalidatePath('/settings')
  revalidatePath(`/u/${username}`)

  return { success: true }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
