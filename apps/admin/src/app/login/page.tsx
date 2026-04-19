import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LoginForm } from './login-form'
import { Sparkles } from 'lucide-react'

const ERROR_MESSAGES: Record<string, string> = {
  not_admin: 'Access denied. Admin role required.',
  auth_error: 'Authentication failed. Please try again.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'admin') {
      redirect('/overview')
    }
  }

  const params = await searchParams
  const errorMessage = params.error ? ERROR_MESSAGES[params.error] ?? 'An error occurred.' : null

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_80%_80%,rgba(99,102,241,0.06),transparent)]" />
      </div>

      <div className="relative z-10 w-full max-w-[380px] px-6">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 ring-1 ring-indigo-500/20">
            <Sparkles className="h-6 w-6 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Galactic
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            RAID Admin Dashboard
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-center text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        <LoginForm />
      </div>
    </div>
  )
}
