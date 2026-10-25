import { Keyboard, Mouse } from 'lucide-react'
import { Segmented } from '@/components/common/segmented'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { LabelMode } from '@/domain/input'
import type { InputMode, ViewMode } from '@/domain/types'
import { IssuesButton } from '@/features/bindings/issues-button'
import { useDataStore, useSettings } from '@/features/data/store'
import { useDevicesStore } from '@/features/devices/store'
import { GamePicker } from '@/features/games/game-picker'
import { ProfilePicker } from '@/features/profiles/profile-picker'
import { SaveStatusIndicator } from '@/features/persistence/storage-banners'
import { ru } from '@/i18n/ru'

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
  const inputMode = useSettings((s) => s.inputMode)
  const labelLang = useSettings((s) => s.labelLang)
  const autoLang = useSettings((s) => s.autoLang)
  const view = useSettings((s) => s.view)
  const showKeyboard = useSettings((s) => s.showKeyboard)
  const showMouse = useSettings((s) => s.showMouse)
  const updateSettings = useDataStore((s) => s.updateSettings)
  const releaseAll = useDevicesStore((s) => s.releaseAll)

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4">
      <div className="flex items-center gap-2">
        <Keyboard className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-base font-semibold tracking-tight whitespace-nowrap max-2xl:sr-only">
          {ru.app.title}
        </h1>
        <span className="text-xs text-muted-foreground max-2xl:hidden">{__APP_VERSION__}</span>
      </div>
      <div className="flex min-w-0 items-center gap-1 border-l pl-3">
        <GamePicker />
        <ProfilePicker />
        <IssuesButton />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <SaveStatusIndicator />
        <Segmented
          label={ru.header.inputMode}
          value={inputMode}
          options={INPUT_MODES}
          onChange={(mode) => {
            updateSettings({ inputMode: mode })
            releaseAll()
          }}
        />
        <div className="flex items-center gap-1">
          <Segmented
            label={ru.header.labelLang}
            value={labelLang}
            options={LABEL_MODES}
            onChange={(mode) => {
              updateSettings({ labelLang: mode })
            }}
          />
          {/* Автопереключение EN ↔ RU по последней клавише; в EN/RU не действует */}
          <ToggleGroup
            type="multiple"
            aria-label={ru.header.autoLang}
            value={autoLang ? ['auto'] : []}
            onValueChange={(next) => {
              updateSettings({ autoLang: next.includes('auto') })
            }}
          >
            <ToggleGroupItem value="auto" title={ru.header.autoLangHint}>
              {ru.header.autoLangShort}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        {/* Показать или скрыть клавиатуру и мышь: скрыто всё — панель на весь экран */}
        <ToggleGroup
          type="multiple"
          aria-label={ru.header.devices}
          value={[showKeyboard && 'keyboard', showMouse && 'mouse'].filter((v) => v !== false)}
          onValueChange={(next) => {
            updateSettings({
              showKeyboard: next.includes('keyboard'),
              showMouse: next.includes('mouse'),
            })
          }}
        >
          <ToggleGroupItem value="keyboard" title={ru.header.showKeyboard}>
            <Keyboard />
          </ToggleGroupItem>
          <ToggleGroupItem value="mouse" title={ru.header.showMouse}>
            <Mouse />
          </ToggleGroupItem>
        </ToggleGroup>
        <Segmented
          label={ru.header.view}
          value={view}
          options={VIEWS}
          onChange={(v) => {
            updateSettings({ view: v })
          }}
        />
      </div>
    </header>
  )
}
