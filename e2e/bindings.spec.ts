import { expect, test, type Page } from '@playwright/test'
import { APP_URL } from './app-url.ts'
import { importPreset } from './presets.ts'

const panel = (page: Page) => page.getByRole('complementary', { name: 'Панель профиля' })
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Привязка клавиши' })
const key = (page: Page, code: string) => page.locator(`[data-input-code="${code}"]`)

/** Кнопка клавиши 1 у действия в списке панели */
function slot(page: Page, action: string) {
  return panel(page)
    .getByRole('group', { name: action, exact: true })
    .getByRole('button', { name: new RegExp(`^Клавиша 1 действия «${action}»`) })
}

async function search(page: Page, text: string) {
  const box = panel(page).getByRole('searchbox', { name: 'Поиск действия' })
  await box.fill(text)
  // Фокус уходит из поля, иначе нажатия клавиш попадут в него
  await box.blur()
}

test('bindings, a conflict and the Ctrl layer survive a reload (FR-12, FR-14, FR-15)', async ({
  page,
}) => {
  await page.goto(APP_URL)
  await page.getByRole('button', { name: 'Из заготовок' }).click()
  await importPreset(page, 'PUBG: BATTLEGROUNDS')
  await expect(panel(page)).toBeVisible()

  // E на «Взаимодействие» (Везде) — нажатием настоящей клавиши
  await search(page, 'Взаимодействие')
  await slot(page, 'Взаимодействие').click()
  await expect(dialog(page)).toContainText('Взаимодействие')
  await page.keyboard.press('KeyE')
  await expect(dialog(page).getByTestId('capture-box')).toHaveText('E')
  await dialog(page).getByRole('button', { name: 'Подтвердить' }).click()
  await expect(slot(page, 'Взаимодействие')).toHaveText('E')

  // E на «Сигнал» (В транспорте) — кликом по экранной клавише; конфликт
  await search(page, 'Сигнал')
  await slot(page, 'Сигнал').click()
  await key(page, 'KeyE').click()
  await expect(dialog(page).getByRole('alert')).toContainText(
    'Клавиша уже привязана к действию «Взаимодействие»',
  )
  await dialog(page).getByRole('button', { name: 'Всё равно привязать' }).click()
  await expect(slot(page, 'Сигнал')).toHaveText('E')
  await expect(page.getByTestId('issues-button')).toHaveAccessibleName('Конфликты: 1')
  await expect(key(page, 'KeyE')).toHaveAttribute('data-conflict', 'true')

  // Ctrl+1 на «Бинт» — комбинацией на настоящей клавиатуре
  await search(page, 'Бинт')
  await slot(page, 'Бинт').click()
  await page.keyboard.press('Control+Digit1')
  await dialog(page).getByRole('button', { name: 'Подтвердить' }).click()
  await expect(slot(page, 'Бинт')).toHaveText('Ctrl+1')
  await expect(key(page, 'Digit1')).not.toContainText('БИН')
  await page.getByRole('radio', { name: /^Ctrl/ }).click()
  await expect(key(page, 'Digit1')).toContainText('БИН')
  await expect(key(page, 'KeyQ')).toHaveAttribute('data-dimmed', 'true')

  // Перезагрузка: всё на месте
  await expect(page.getByTestId('save-status')).toHaveText('Сохранено')
  await page.reload()
  await expect(page.getByTestId('issues-button')).toHaveAccessibleName('Конфликты: 1')
  await expect(key(page, 'KeyE')).toHaveAttribute('data-conflict', 'true')
  await expect(key(page, 'KeyE')).toContainText('ВЗА')
  await page.getByRole('radio', { name: /^Ctrl/ }).click()
  await expect(key(page, 'Digit1')).toContainText('БИН')

  // Счётчик ведёт к клавише
  await page.getByTestId('issues-button').click()
  await page
    .getByRole('dialog', { name: 'Конфликты и нарушения правил' })
    .getByRole('button')
    .first()
    .click()
  await expect(key(page, 'KeyE')).toHaveAttribute('data-selected', 'true')
  await expect(panel(page).getByRole('heading', { name: 'E' })).toBeVisible()
})

test('a mouse button is bound in the bind window; hidden devices give the settings window', async ({
  page,
}) => {
  await page.goto(APP_URL)
  await page.getByRole('button', { name: 'Из заготовок' }).click()
  await importPreset(page, 'Dota 2')

  // Боковая кнопка мыши над полем окна привязки (FR-12)
  await search(page, 'Патрулировать')
  await slot(page, 'Патрулировать').click()
  await dialog(page).getByTestId('capture-box').click({ button: 'middle' })
  await expect(dialog(page).getByTestId('capture-box')).toHaveText('Колесо')
  await dialog(page).getByRole('button', { name: 'Подтвердить' }).click()
  await expect(slot(page, 'Патрулировать')).toHaveText('Колесо')

  // Клавиатура и мышь скрыты — панель становится окном с боковым меню
  await page.getByRole('button', { name: 'Показать или скрыть клавиатуру' }).click()
  await page.getByRole('button', { name: 'Показать или скрыть мышь' }).click()
  await expect(page.getByTestId('device-stage')).toBeHidden()
  const nav = page.getByRole('navigation', { name: 'Разделы' })
  await nav.getByRole('button', { name: 'Мини-карта' }).click()
  await expect(panel(page).getByRole('heading', { name: 'Мини-карта', level: 3 })).toBeInViewport()
})

test('while the marquee is dragged the panel shows only the count, the list comes after release (FR-13)', async ({
  page,
}) => {
  await page.goto(APP_URL)
  await page.getByRole('button', { name: 'Из заготовок' }).click()
  await importPreset(page, 'Dota 2')
  await expect(panel(page)).toBeVisible()
  const q = await key(page, 'KeyQ').boundingBox()
  const w = await key(page, 'KeyW').boundingBox()
  const stage = await page.getByTestId('device-stage').boundingBox()
  if (!q || !w || !stage) throw new Error('no layout')

  await page.mouse.move(q.x + q.width / 2, stage.y + 5)
  await page.mouse.down()
  await page.mouse.move(w.x + w.width / 2, w.y + w.height / 2, { steps: 5 })
  const heading = panel(page).getByRole('heading', { level: 2 })
  await expect(heading).toHaveText(/^Выделено: \d+$/)
  const count = await heading.textContent()
  await expect(panel(page).getByRole('button', { name: 'Создать группу' })).toHaveCount(0)
  await expect(panel(page).getByRole('region', { name: 'Q' })).toHaveCount(0)

  await page.mouse.up()
  await expect(heading).toHaveText(count ?? '')
  await expect(panel(page).getByRole('button', { name: 'Создать группу' })).toBeVisible()
  await expect(panel(page).getByRole('region', { name: 'Q' })).toBeVisible()
})
