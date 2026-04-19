'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Users, Gamepad2, Settings, Sparkles, LogOut, Radio } from 'lucide-react'
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'

interface AdminSidebarProps {
  profile: {
    username: string | null
    display_name: string | null
    avatar_url: string | null
    email: string
  }
}

const navItems = [
  { title: 'Overview', href: '/overview', icon: LayoutDashboard },
  { title: 'Sessions', href: '/sessions', icon: Radio },
  { title: 'Users', href: '/users', icon: Users },
  { title: 'Games', href: '/games', icon: Gamepad2 },
  { title: 'Config', href: '/config', icon: Settings },
]

export function AdminSidebar({ profile }: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const displayName = profile.display_name || profile.username || 'Admin'
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Brand */}
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600/15">
            <Sparkles className="h-4 w-4 text-indigo-400" />
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground group-data-[collapsible=icon]:hidden">
            Galactic
          </span>
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/60">
            Navigation
          </SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={isActive}
                    tooltip={item.title}
                    className={
                      isActive
                        ? 'bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/15 hover:text-indigo-300'
                        : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* User footer */}
      <SidebarFooter className="p-2">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <Avatar className="h-7 w-7 rounded-md">
            {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={displayName} />}
            <AvatarFallback className="rounded-md bg-indigo-600/15 text-[11px] font-medium text-indigo-400">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden min-w-0 flex-1">
            <span className="text-sm font-medium text-foreground truncate">{displayName}</span>
            <span className="text-[11px] text-muted-foreground truncate">{profile.email}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="ml-auto p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors group-data-[collapsible=icon]:hidden"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
