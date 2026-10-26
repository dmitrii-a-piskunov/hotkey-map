import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { isTheme } from '@/domain/theme'
import type { Theme } from '@/domain/types'
import { useDataStore, useSettings } from '@/features/data/store'
import { ru } from '@/i18n/ru'

const t = ru.theme

const THEMES = [
  { value: 'system', label: t.system, Icon: Monitor },
  { value: 'light', label: t.light, Icon: Sun },
  { value: 'dark', label: t.dark, Icon: Moon },
] as const satisfies readonly { value: Theme; label: string; Icon: typeof Sun }[]

/** Тема в шапке (FR-25): иконка текущего выбора и меню из трёх вариантов */
export function ThemeButton() {
  const theme = useSettings((s) => s.theme)
  const current = THEMES.find((x) => x.value === theme) ?? THEMES[0]
  const label = `${t.label}: ${current.label}`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} title={label}>
          <current.Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t.label}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(v) => {
            if (isTheme(v)) useDataStore.getState().updateSettings({ theme: v })
          }}
        >
          {THEMES.map(({ value, label: name, Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon />
              {name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
