/**
 * Команды биндов, групп клавиш, значений настроек и заметок текущего
 * профиля. Изменения — чистые функции из src/domain через apply (FR-24).
 */

import {
  assignBinding,
  captureError,
  freeSlot,
  layerModifiers,
  makeInput,
  removeBindings,
  setBindingParam,
  setPressType,
} from '@/domain/bindings'
import { systemClock } from '@/domain/clock'
import { conflictsWith } from '@/domain/conflicts'
import { currentGame, currentProfile } from '@/domain/current'
import { updateGame } from '@/domain/games'
import {
  addToKeyGroup,
  copyKeyGroup,
  createKeyGroup,
  removeFromKeyGroup,
  removeKeyGroup,
  updateKeyGroup,
  type KeyGroupDraft,
} from '@/domain/key-groups'
import { actionHighlight } from '@/domain/layers'
import { setProfileNotes } from '@/domain/profiles'
import { resetSettingValue, setSettingValue } from '@/domain/setting-values'
import type { Game, Modifier, PressType, Profile, SettingValue } from '@/domain/types'
import { useDataStore } from '@/features/data/store'
import {
  cancelCapture,
  setFeedback,
  setHighlight,
  setLayer,
  useBindingsUi,
  type SlotRef,
} from './ui-store'

const clock = systemClock

interface Current {
  game: Game
  profile: Profile
}

function current(): Current | null {
  const data = useDataStore.getState().data
  const game = currentGame(data)
  const profile = game && currentProfile(game, data.appSettings)
  return game && profile ? { game, profile } : null
}

function onGame(gameId: string, fn: (game: Game) => Game): void {
  useDataStore.getState().apply((d) => updateGame(d, gameId, fn, clock.now()))
}

/**
 * Назначение входа в слот (FR-12): правила игры, затем сохранение и
 * проверка конфликтов. Ошибка правил — сообщение под кнопкой, бинд не
 * сохраняется; конфликт — предупреждение, бинд сохранён.
 */
function assignToSlot(ref: SlotRef, code: string, modifiers: readonly Modifier[]): void {
  const cur = current()
  if (!cur) return
  const input = makeInput(code, modifiers)
  const error = captureError(cur.game, input)
  if (error) {
    setFeedback({ ...ref, kind: 'error', error })
    return
  }
  onGame(cur.game.id, (g) => assignBinding(g, { profileId: cur.profile.id, ...ref }, input, clock))
  const after = current()
  const binding = after?.profile.bindings.find(
    (b) => b.actionId === ref.actionId && b.slot === ref.slot,
  )
  const clashes = after && binding ? conflictsWith(after.game, after.profile, binding.id) : []
  setFeedback(
    binding && clashes.length > 0 ? { ...ref, kind: 'conflict', bindingId: binding.id } : null,
  )
}

/** Вход, пойманный в режиме захвата: клавиша, комбинация, кнопка мыши или клик */
export function captureInputCmd(code: string, modifiers: readonly Modifier[]): void {
  const ref = useBindingsUi.getState().capture
  if (!ref) return
  cancelCapture()
  assignToSlot(ref, code, modifiers)
}

/**
 * Модификаторы клика по экранной клавише в захвате: зажатые, а если ничего
 * не зажато — модификаторы текущего слоя. Так назначаются и комбинации,
 * которые забирает браузер.
 */
export function clickModifiers(held: readonly Modifier[]): Modifier[] {
  return held.length > 0 ? [...held] : layerModifiers(useBindingsUi.getState().layer)
}

/**
 * «Назначить действие» на выделенную клавишу (TC-01, TC-02): в первый
 * свободный слот, с модификаторами текущего слоя.
 */
export function assignActionToInputCmd(actionId: string, code: string): void {
  const cur = current()
  if (!cur) return
  const slot = freeSlot(cur.game, cur.profile, actionId)
  if (slot === null) {
    setFeedback({ actionId, slot: 1, kind: 'noFreeSlot' })
    return
  }
  assignToSlot({ actionId, slot }, code, layerModifiers(useBindingsUi.getState().layer))
}

export function unassignCmd(ref: SlotRef): void {
  const cur = current()
  if (!cur) return
  const binding = cur.profile.bindings.find(
    (b) => b.actionId === ref.actionId && b.slot === ref.slot,
  )
  if (!binding) return
  onGame(cur.game.id, (g) => removeBindings(g, cur.profile.id, [binding.id], clock.now()))
  const fb = useBindingsUi.getState().feedback
  if (fb?.actionId === ref.actionId && fb.slot === ref.slot) setFeedback(null)
}

/** «Снять с других действий» (FR-12, шаг 4) */
export function unbindOthersCmd(bindingId: string): void {
  const cur = current()
  if (!cur) return
  const others = conflictsWith(cur.game, cur.profile, bindingId).map((b) => b.id)
  if (others.length > 0) {
    onGame(cur.game.id, (g) => removeBindings(g, cur.profile.id, others, clock.now()))
  }
  setFeedback(null)
}

export function setPressTypeCmd(bindingId: string, pressType: PressType): void {
  const cur = current()
  if (!cur) return
  onGame(cur.game.id, (g) => setPressType(g, cur.profile.id, bindingId, pressType, clock.now()))
}

export function setBindingParamCmd(bindingId: string, optionId: string | undefined): void {
  const cur = current()
  if (!cur) return
  onGame(cur.game.id, (g) => setBindingParam(g, cur.profile.id, bindingId, optionId, clock.now()))
}

/** Поиск (FR-16): подсветить клавиши действия, при необходимости сменить слой */
export function highlightActionCmd(actionId: string, pinned: boolean): void {
  const cur = current()
  const { layer } = useBindingsUi.getState()
  const hl = actionHighlight(cur?.profile, actionId, layer)
  setLayer(hl.layer)
  setHighlight({ actionId, codes: hl.codes, pinned })
}

/** Снять подсветку наведения; закреплённая кликом остаётся */
export function clearHoverHighlightCmd(): void {
  const hl = useBindingsUi.getState().highlight
  if (hl && !hl.pinned) setHighlight(null)
}

// Группы клавиш (FR-29)

export function createKeyGroupCmd(draft: KeyGroupDraft, codes: readonly string[]): void {
  const cur = current()
  if (!cur) return
  onGame(cur.game.id, (g) => createKeyGroup(g, cur.profile.id, draft, codes, clock).game)
}

export function updateKeyGroupCmd(groupId: string, draft: KeyGroupDraft): void {
  const cur = current()
  if (!cur) return
  onGame(cur.game.id, (g) => updateKeyGroup(g, cur.profile.id, groupId, draft, clock.now()))
}

export function addToKeyGroupCmd(groupId: string, codes: readonly string[]): void {
  const cur = current()
  if (!cur) return
  onGame(cur.game.id, (g) => addToKeyGroup(g, cur.profile.id, groupId, codes, clock.now()))
}

export function removeFromKeyGroupCmd(groupId: string, codes: readonly string[]): void {
  const cur = current()
  if (!cur) return
  onGame(cur.game.id, (g) => removeFromKeyGroup(g, cur.profile.id, groupId, codes, clock.now()))
}

export function removeKeyGroupCmd(groupId: string): void {
  const cur = current()
  if (!cur) return
  onGame(cur.game.id, (g) => removeKeyGroup(g, cur.profile.id, groupId, clock.now()))
}

export function copyKeyGroupCmd(groupId: string, toProfileId: string): void {
  const cur = current()
  if (!cur) return
  onGame(cur.game.id, (g) => copyKeyGroup(g, cur.profile.id, groupId, toProfileId, clock))
}

// Значения настроек (FR-18) и заметки (FR-11)

export function setSettingValueCmd(settingId: string, value: SettingValue): void {
  const cur = current()
  if (!cur) return
  onGame(cur.game.id, (g) => setSettingValue(g, cur.profile.id, settingId, value, clock.now()))
}

export function resetSettingValueCmd(settingId: string): void {
  const cur = current()
  if (!cur) return
  onGame(cur.game.id, (g) => resetSettingValue(g, cur.profile.id, settingId, clock.now()))
}

export function setNotesCmd(gameId: string, profileId: string, notes: string): void {
  onGame(gameId, (g) => {
    const profile = g.profiles.find((p) => p.id === profileId)
    return !profile || profile.notes === notes
      ? g
      : setProfileNotes(g, profileId, notes, clock.now())
  })
}
