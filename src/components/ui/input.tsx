import type * as React from 'react'

import { cn } from '@/lib/utils'

const fieldClass =
  'w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(fieldClass, 'h-9 py-1', className)}
      {...props}
    />
  )
}

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldClass, 'min-h-16 py-2', className)}
      {...props}
    />
  )
}

/** Обычный select: работает с клавиатуры и одинаково в Chrome и Firefox */
function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select data-slot="select" className={cn(fieldClass, 'h-9 py-1 pr-8', className)} {...props} />
  )
}

export { Input, NativeSelect, Textarea }
