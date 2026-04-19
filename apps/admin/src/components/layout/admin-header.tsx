'use client'

import { usePathname } from 'next/navigation'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'

const pageTitles: Record<string, string> = {
  '/overview': 'Overview',
  '/sessions': 'Active Sessions',
  '/users': 'Users',
  '/games': 'Games',
  '/config': 'Config',
}

export function AdminHeader() {
  const pathname = usePathname()

  const pageTitle =
    Object.entries(pageTitles).find(([path]) => pathname.startsWith(path))?.[1] ?? 'Dashboard'

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-sidebar-border bg-background px-4">
      <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
      <Separator orientation="vertical" className="mr-1 h-5" />
      <h1 className="text-sm font-medium text-foreground">{pageTitle}</h1>
    </header>
  )
}
