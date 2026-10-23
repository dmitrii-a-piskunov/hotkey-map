import { TriangleAlert } from 'lucide-react'
import { Segmented } from '@/components/common/segmented'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { ColorMode } from '@/domain/types'
import { layerName } from '@/features/bindings/format'
import { setHighlight, setLayer, useBindingsUi } from '@/features/bindings/ui-store'
import { useCurrentLayers } from '@/features/bindings/use-bindings'
import { useDataStore, useSettings } from '@/features/data/store'
import { ru } from '@/i18n/ru'
import { fill } from '@/lib/format'

/** Radix не различает пустое значение и «ничего не выбрано» — у основного слоя своя метка */
const BASE_VALUE = 'base'
const toValue = (key: string) => key || BASE_VALUE

const COLOR_MODES = [
  { value: 'category', label: ru.bindings.byCategory },
  { value: 'group', label: ru.bindings.byGroup },
] as const satisfies readonly { value: ColorMode; label: string }[]

/**
 * Над клавиатурой: слои модификаторов с числом биндов (FR-14), режим
 * окраски (FR-30) и подписи действий на клавишах (FR-26).
 */
export function StageToolbar() {
  const layers = useCurrentLayers()
  const layer = useBindingsUi((s) => s.layer)
  const colorMode = useSettings((s) => s.colorMode)
  const showLabels = useSettings((s) => s.showLabels)
  const updateSettings = useDataStore((s) => s.updateSettings)

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b bg-background px-4 py-2">
      <ToggleGroup
        type="single"
        aria-label={ru.bindings.layers}
        value={toValue(layer)}
        onValueChange={(next) => {
          // Повторный клик отдаёт пустую строку — слой не снимаем
          const picked = layers.find((l) => toValue(l.key) === next)
          if (picked) {
            setLayer(picked.key)
            setHighlight(null)
          }
        }}
      >
        {layers.map((l) => (
          <ToggleGroupItem
            key={l.key}
            value={toValue(l.key)}
            title={fill(ru.bindings.layerHint, { count: l.count })}
          >
            {layerName(l.key)}
            <span className="text-xs text-muted-foreground tabular-nums">{l.count}</span>
            {l.hasIssues && (
              <TriangleAlert className="text-destructive" aria-label={ru.bindings.layerIssues} />
            )}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="ml-auto flex items-center gap-3">
        <Segmented
          label={ru.bindings.colorMode}
          value={colorMode}
          options={COLOR_MODES}
          onChange={(mode) => {
            updateSettings({ colorMode: mode })
          }}
        />
        <ToggleGroup
          type="multiple"
          aria-label={ru.bindings.showLabels}
          value={showLabels ? ['labels'] : []}
          onValueChange={(next) => {
            updateSettings({ showLabels: next.includes('labels') })
          }}
        >
          <ToggleGroupItem value="labels" title={ru.bindings.showLabels}>
            {ru.bindings.showLabelsShort}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  )
}
