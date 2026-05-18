import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

import { ImmersiveShell } from '@/components/immersive-shell'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: ReactNode
  title: string
  description: string
  actions?: ReactNode
  contentClassName?: string
}

export function AppShell({ children, title, description, actions, contentClassName }: AppShellProps) {
  return (
    <ImmersiveShell
      navigation={
        <>
          <Link to="/groups" className="transition-colors hover:text-foreground">
            Groups
          </Link>
          <Link to="/" className="transition-colors hover:text-foreground">
            Home
          </Link>
          <Link to="/logout" className="transition-colors hover:text-foreground">
            Sign out
          </Link>
        </>
      }
      contentClassName={cn('py-8 sm:py-10', contentClassName)}
    >
      <div className="flex w-full flex-col gap-6">
        <section className="grid gap-4 rounded-[2rem] border border-border/70 bg-card/70 p-5 shadow-[0_20px_60px_rgba(74,68,88,0.08)] backdrop-blur-xl sm:p-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
          </div>
          {actions ? <div className="flex flex-wrap gap-3 lg:justify-end">{actions}</div> : null}
        </section>
        {children}
      </div>
    </ImmersiveShell>
  )
}
