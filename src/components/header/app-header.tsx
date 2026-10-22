import { Keyboard } from 'lucide-react'
import type { ReactNode } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { LabelMode } from '@/domain/input'
import { useDevicesStore, type InputMode, type ViewMode } from '@/features/devices/store'
import { ru } from '@/i18n/ru'

interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: readonly { value: T; label: ReactNode }[]
  onChange: (value: T) => void
}

function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
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
        <ToggleGroupItem key={o.value} value={o.value}>
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

const INPUT_MODES = [
  { value: 'check', label: ru.header.modeCheck },
  { value: 'nav', label: ru.header.modeNav },
] as const satisfies readonly { value: InputMode; label: string }[]

// FR-04: EN/RU — как на настоящей клавиатуре; EN и RU — только нужное для биндов
const LABEL_MODES = [
  { value: 'enru', label: 'EN/RU' },
  { value: 'en', label: 'EN' },
  { value: 'ru', label: 'RU' },
] as const satisfies readonly { value: LabelMode; label: string }[]

// FR-01: переключатель 2D / 3D переедет в настройки приложения, когда они появятся
const VIEWS = [
  { value: '3d', label: '3D' },
  { value: '2d', label: '2D' },
] as const satisfies readonly { value: ViewMode; label: string }[]

export function AppHeader() {
  const inputMode = useDevicesStore((s) => s.inputMode)
  const labelLang = useDevicesStore((s) => s.labelLang)
  const view = useDevicesStore((s) => s.view)
  const setInputMode = useDevicesStore((s) => s.setInputMode)
  const setLabelLang = useDevicesStore((s) => s.setLabelLang)
  const autoLang = useDevicesStore((s) => s.autoLang)
  const setAutoLang = useDevicesStore((s) => s.setAutoLang)
  const setView = useDevicesStore((s) => s.setView)

  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b bg-background px-4">
      <div className="flex items-center gap-2">
        <Keyboard className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-base font-semibold tracking-tight">{ru.app.title}</h1>
        <span className="text-xs text-muted-foreground">{__APP_VERSION__}</span>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <Segmented
          label={ru.header.inputMode}
          value={inputMode}
          options={INPUT_MODES}
          onChange={setInputMode}
        />
        <div className="flex items-center gap-1">
          <Segmented
            label={ru.header.labelLang}
            value={labelLang}
            options={LABEL_MODES}
            onChange={setLabelLang}
          />
          {/* Автопереключение EN ↔ RU по последней клавише; в EN/RU не действует */}
          <ToggleGroup
            type="multiple"
            aria-label={ru.header.autoLang}
            value={autoLang ? ['auto'] : []}
            onValueChange={(next) => {
              setAutoLang(next.includes('auto'))
            }}
          >
            <ToggleGroupItem value="auto" title={ru.header.autoLangHint}>
              {ru.header.autoLangShort}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <Segmented label={ru.header.view} value={view} options={VIEWS} onChange={setView} />
      </div>
    </header>
  )
}
