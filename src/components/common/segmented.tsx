import type { ReactNode } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: readonly { value: T; label: ReactNode; title?: string }[]
  onChange: (value: T) => void
}

/** Переключатель из нескольких вариантов: один всегда выбран */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  return (
    <ToggleGroup
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        // Radix отдаёт пустую строку при повторном клике — выбор не снимаем
        const option = options.find((o) => o.value === next)
        if (option) onChange(option.value)
      }}
    >
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} title={o.title}>
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
