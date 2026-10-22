import { expect, test, type Page } from '@playwright/test'
import { APP_URL } from './app-url.ts'

/** Красный квадрат 1×1 в PNG */
const PNG_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const editor = (page: Page) => page.getByRole('dialog', { name: 'Тестовая игра' })

/** Перетаскивание картинки в область иконки (FR-05) */
async function dropIcon(page: Page) {
  await page.getByTestId('icon-drop').evaluate((zone, base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const data = new DataTransfer()
    data.items.add(new File([bytes], 'icon.png', { type: 'image/png' }))
    zone.dispatchEvent(
      new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }),
    )
  }, PNG_1PX)
}

async function addAction(page: Page, name: string, nameEn: string) {
  await editor(page).getByRole('button', { name: 'Добавить действие' }).first().click()
  const form = page.getByRole('dialog', { name: 'Новое действие' })
  await form.getByLabel('Название', { exact: true }).fill(name)
  await form.getByLabel('Оригинальное название (EN)').fill(nameEn)
  await form.getByLabel('Контекст').selectOption({ label: 'Пешком' })
  await form.getByLabel('Категория').selectOption({ label: 'Движение' })
  await form.getByRole('button', { name: 'Добавить' }).click()
  await expect(form).toBeHidden()
}

test('a new game with icon, context, category and actions survives a reload (FR-05 – FR-08)', async ({
  page,
}) => {
  await page.goto(APP_URL)
  await expect(page.getByText('Добавьте первую игру')).toBeVisible()

  // Пустое состояние → «Создать игру» → редактор
  await page.getByRole('button', { name: 'Создать игру' }).click()
  const create = page.getByRole('dialog', { name: 'Новая игра' })
  await create.getByLabel('Название').fill('Тестовая игра')
  await create.getByRole('button', { name: 'Создать' }).click()
  await expect(editor(page)).toBeVisible()
  await expect(page.getByTestId('current-game')).toHaveText('Тестовая игра')
  await expect(page.getByTestId('current-profile')).toHaveText('Основной')

  await dropIcon(page)
  await expect(page.getByTestId('icon-drop').locator('img')).toBeVisible()

  await editor(page).getByRole('tab', { name: 'Контексты' }).click()
  await editor(page).getByLabel('Новый контекст').fill('Пешком')
  await editor(page).getByRole('button', { name: 'Добавить' }).click()
  await expect(editor(page).getByText('Пешком')).toBeVisible()

  await editor(page).getByRole('tab', { name: 'Категории' }).click()
  await editor(page).getByRole('button', { name: 'Новая категория' }).click()
  const category = page.getByRole('dialog', { name: 'Новая категория' })
  await category.getByLabel('Название').fill('Движение')
  await category.getByRole('button', { name: 'Добавить' }).click()
  await expect(editor(page).getByText('Движение')).toBeVisible()

  await editor(page).getByRole('tab', { name: 'Действия' }).click()
  await expect(editor(page).getByText('В игре пока нет действий')).toBeVisible()
  await addAction(page, 'Прыжок', 'Jump')
  await addAction(page, 'Бег', 'Sprint')
  await addAction(page, 'Присесть', 'Crouch')

  await expect(page.getByTestId('save-status')).toHaveText('Сохранено')
  await page.reload()

  await expect(page.getByTestId('current-game')).toHaveText('Тестовая игра')
  await expect(page.getByRole('button', { name: 'Выбор игры' }).locator('img')).toBeVisible()
  await page.getByRole('button', { name: 'Редактор игры' }).click()
  await editor(page).getByRole('tab', { name: 'Действия' }).click()
  const section = editor(page).getByRole('region', { name: 'Движение' })
  await expect(section.locator('[data-sortable-id]')).toHaveText([/Прыжок/, /Бег/, /Присесть/])
  await expect(section.getByText('Пешком')).toHaveCount(3)

  // FR-16: поиск по английскому названию
  await editor(page).getByRole('searchbox', { name: 'Поиск по названию' }).fill('sprint')
  await expect(editor(page).locator('[data-sortable-id]')).toHaveText([/Бег/])
})

test('profiles: create, duplicate, rename and delete (FR-11)', async ({ page }) => {
  await page.goto(APP_URL)
  await page.getByRole('button', { name: 'Создать игру' }).click()
  await page
    .getByRole('dialog', { name: 'Новая игра' })
    .getByLabel('Название')
    .fill('Тестовая игра')
  await page.getByRole('button', { name: 'Создать' }).click()
  await page.keyboard.press('Escape')
  await expect(editor(page)).toBeHidden()

  const profileMenu = () => page.getByRole('button', { name: 'Выбор профиля' })
  await profileMenu().click()
  await expect(page.getByRole('menuitem', { name: 'Удалить профиль' })).toBeDisabled()
  await page.getByRole('menuitem', { name: 'Дублировать' }).click()
  await expect(page.getByTestId('current-profile')).toHaveText('Копия Основной')

  await profileMenu().click()
  await page.getByRole('menuitem', { name: 'Профиль и заметки' }).click()
  const dialog = page.getByRole('dialog', { name: 'Профиль и заметки' })
  await dialog.getByLabel('Название').fill('Гость')
  await dialog.getByLabel('Заметки').fill('Сенса 42')
  await dialog.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByTestId('current-profile')).toHaveText('Гость')

  await profileMenu().click()
  await page.getByRole('menuitem', { name: 'Удалить профиль' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Удалить' }).click()
  await expect(page.getByTestId('current-profile')).toHaveText('Основной')
})

test('a Steam desktop shortcut gives the game icon and AppID (FR-05)', async ({ page }) => {
  let requested = ''
  await page.route('https://shared.fastly.steamstatic.com/**', (route) => {
    requested = route.request().url()
    return route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*' },
      contentType: 'image/png',
      body: Buffer.from(PNG_1PX, 'base64'),
    })
  })
  await page.goto(APP_URL)
  await page.getByRole('button', { name: 'Создать игру' }).click()
  await page
    .getByRole('dialog', { name: 'Новая игра' })
    .getByLabel('Название')
    .fill('Тестовая игра')
  await page.getByRole('button', { name: 'Создать' }).click()

  const shortcut = [
    '[InternetShortcut]',
    'URL=steam://rungameid/570',
    String.raw`IconFile=C:\Program Files (x86)\Steam\steam\games\27062de94099414e44f149f1f9dc8e8bed905341.ico`,
  ].join('\r\n')
  await page.getByTestId('icon-file').setInputFiles({
    name: 'Dota 2.url',
    mimeType: '',
    buffer: Buffer.from(shortcut),
  })
  await expect(page.getByTestId('icon-drop').locator('img')).toBeVisible()
  expect(requested).toBe(
    'https://shared.fastly.steamstatic.com/community_assets/images/apps/570/27062de94099414e44f149f1f9dc8e8bed905341.ico',
  )
  await expect(editor(page).getByLabel('Steam AppID')).toHaveValue('570')
})

test('a game is deleted from the header after confirmation (FR-05)', async ({ page }) => {
  await page.goto(APP_URL)
  await page.getByRole('button', { name: 'Создать игру' }).click()
  await page
    .getByRole('dialog', { name: 'Новая игра' })
    .getByLabel('Название')
    .fill('Тестовая игра')
  await page.getByRole('button', { name: 'Создать' }).click()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Выбор игры' }).click()
  await page.getByRole('menuitem', { name: 'Удалить игру' }).click()
  const confirm = page.getByRole('alertdialog', { name: 'Удалить игру «Тестовая игра»?' })
  await expect(confirm).toContainText('профили (1), действия (0) и бинды (0)')
  await confirm.getByRole('button', { name: 'Удалить' }).click()

  await expect(page.getByText('Добавьте первую игру')).toBeVisible()
  // Пустое состояние — слева от клавиатуры
  const panel = await page.getByRole('complementary').boundingBox()
  const stage = await page.getByTestId('device-stage').boundingBox()
  expect(panel && stage && panel.x < stage.x).toBe(true)
})
