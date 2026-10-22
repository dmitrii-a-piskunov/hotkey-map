import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { isHexColor, PALETTE } from '@/domain/categories'
import { ru } from '@/i18n/ru'
import { cn } from '@/lib/utils'

const t = ru.editor.categories

/** Цвет из палитры 12 цветов или свой HEX (FR-07) */
export function ColorField({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (color: string) => void
}) {
  const [hex, setHex] = useState(value)
  const hexError = !isHexColor(hex)

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t.color}>
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value.toUpperCase() === c}
            aria-label={c}
            title={c}
            className={cn(
              'size-6 rounded-full border-2 border-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              value.toUpperCase() === c && 'border-foreground',
            )}
            style={{ background: c }}
            onClick={() => {
              setHex(c)
              onChange(c)
            }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span
          className="size-6 shrink-0 rounded border"
          style={{ background: isHexColor(hex) ? hex : 'transparent' }}
        />
        <Input
          id={id}
          aria-label={t.customColor}
          className="h-8 w-28 font-mono"
          value={hex}
          aria-invalid={hexError || undefined}
          onChange={(e) => {
            const next = e.target.value.trim()
            setHex(next)
            if (isHexColor(next)) onChange(next.toUpperCase())
          }}
        />
        {hexError && <span className="text-xs text-destructive">{t.colorError}</span>}
      </div>
    </div>
  )
}
