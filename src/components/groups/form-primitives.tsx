import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

export function FieldLabel({ className, ...props }: ComponentProps<'label'>) {
  return <label className={cn('text-sm font-medium text-foreground', className)} {...props} />
}

export function FieldHint({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-xs leading-5 text-muted-foreground', className)} {...props} />
}

export function TextInput({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-[1rem] border border-border/80 bg-background/90 px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20',
        className,
      )}
      {...props}
    />
  )
}

export function TextArea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'min-h-28 w-full rounded-[1rem] border border-border/80 bg-background/90 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20',
        className,
      )}
      {...props}
    />
  )
}

export function SelectInput({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-11 w-full rounded-[1rem] border border-border/80 bg-background/90 px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20',
        className,
      )}
      {...props}
    />
  )
}

export function FormMessage({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-[1rem] border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive',
        className,
      )}
      {...props}
    />
  )
}
