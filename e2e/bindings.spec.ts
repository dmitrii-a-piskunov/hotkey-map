import { expect, test, type Page } from '@playwright/test'
import { APP_URL } from './app-url.ts'

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
  await page.getByRole('button', { name: 'Добавить PUBG: BATTLEGROUNDS' }).click()
  await page.keyboard.press('Escape')
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
  await expect(key(page, 'Digit1')).not.toContainText('Бинт')
  await page.getByRole('radio', { name: /^Ctrl/ }).click()
  await expect(key(page, 'Digit1')).toContainText('Бинт')
  await expect(key(page, 'KeyQ')).toHaveAttribute('data-dimmed', 'true')

  // Перезагрузка: всё на месте
  await expect(page.getByTestId('save-status')).toHaveText('Сохранено')
  await page.reload()
  await expect(page.getByTestId('issues-button')).toHaveAccessibleName('Конфликты: 1')
  await expect(key(page, 'KeyE')).toHaveAttribute('data-conflict', 'true')
  await expect(key(page, 'KeyE')).toContainText('Взаимо')
  await page.getByRole('radio', { name: /^Ctrl/ }).click()
  await expect(key(page, 'Digit1')).toContainText('Бинт')

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
