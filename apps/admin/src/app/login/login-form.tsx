'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError('Invalid credentials.')
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Authentication failed.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      await supabase.auth.signOut()
      setError('Access denied. Admin role required.')
      setLoading(false)
      return
    }

    router.push('/overview')
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-6 shadow-xl shadow-black/20 backdrop-blur-sm">
      <form onSubmit={handleSignIn} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className="h-11 bg-background/50 border-border/50 focus-visible:ring-indigo-500/30"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-11 bg-background/50 border-border/50 focus-visible:ring-indigo-500/30"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>
    </div>
  )
}
