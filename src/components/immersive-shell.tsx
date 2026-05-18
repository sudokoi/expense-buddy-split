import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface ImmersiveShellProps {
  children: ReactNode
  scene?: ReactNode
  className?: string
  contentClassName?: string
  surface?: 'light' | 'immersive'
}

export function ImmersiveShell({
  children,
  scene,
  className,
  contentClassName,
  surface = 'light',
}: ImmersiveShellProps) {
  return (
    <div
      className={cn(
        'immersive-shell min-h-screen',
        surface === 'immersive' && 'immersive-shell-dark',
        className,
      )}
    >
      <div className="immersive-shell__ambient" aria-hidden="true" />
      {scene ? (
        <div className="immersive-shell__scene" aria-hidden="true">
          {scene}
        </div>
      ) : null}
      <div className="relative z-10 min-h-screen">
        <header className="px-4 pt-4 sm:px-6 sm:pt-6">
          <div className="immersive-nav mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 rounded-[2rem] px-4 py-3 sm:px-5">
            <div className="flex items-center gap-3">
              <div className="size-3 rounded-full bg-primary shadow-[0_0_30px_rgba(255,145,164,0.55)]" />
              <div>
                <div className="text-sm font-semibold tracking-tight sm:text-base">Expense Buddy Split</div>
                <div className="text-xs text-muted-foreground">Shared groups, splits, and settle-ups</div>
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
              <a href="#how-it-works" className="transition-colors hover:text-foreground">
                How it works
              </a>
              <a href="#v1-scope" className="transition-colors hover:text-foreground">
                V1 scope
              </a>
            </nav>
          </div>
        </header>

        <main
          className={cn(
            'relative mx-auto flex w-full max-w-7xl flex-1 px-4 pb-10 sm:px-6 sm:pb-12',
            contentClassName,
          )}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
