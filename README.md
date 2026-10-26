# Hotkey Map

A web app that shows your game keybinds on a 3D on-screen copy of your keyboard and mouse. Keep binds and game settings for different games and players, spot conflicts at a glance, and store everything in a folder on your own computer.

> **RU:** Веб-приложение, которое показывает игровые бинды на объёмной экранной копии вашей клавиатуры и мыши. Бинды и настройки хранятся по играм и профилям игроков в папке на вашем компьютере. Интерфейс — на русском. Подробное техническое задание — в [`docs/TZ.md`](docs/TZ.md).

**Open the app:** https://dmitrii-a-piskunov.github.io/hotkey-map/

## Status

Version 1.0 (MVP). No server: everything runs in the browser, your data never leaves your computer.

## Features

- 3D keyboard (AULA F75, 75% ANSI, 80 keys) and a mouse with two side buttons; 2D view as an option
- Games with actions, contexts, categories, a bind parameter and a settings template
- Several player profiles per game: binds, key combos with Ctrl / Shift / Alt, settings with sliders, notes
- Explorer-style key selection (click, Ctrl+click, Shift+click, marquee, arrows), key groups, modifier layers
- Conflicts and rule violations that respect game contexts
- Data in a folder you choose (File System Access API) with autosave and 5 automatic backups
- Import and export to `*.hotkeymap.json` (everything, one game or one profile) with merge, copy or replace
- Presets for Dota 2 and PUBG
- Undo and redo (50 steps), light, dark and system themes
- Installable as a PWA, works offline after the first load

## Browsers

- **Chrome or Edge** — full mode: data lives in a folder on your disk (`data.json`, `icons/`, `backups/`).
- **Firefox** — fallback mode: data lives in the browser (IndexedDB). Export regularly; the app reminds you after 7 days. Known limit: Firefox does not let a page cancel Back / Forward on the side mouse buttons.

Open the app in one tab: a second tab opens view-only.

## Using it

1. Open the app and choose an empty folder for your data (Chrome, Edge). The app offers the Dota 2 and PUBG presets.
2. Pick a game and a profile in the header. Select a key on the screen or press a real key, then assign an action in the panel on the right.
3. **Menu (☰) → Export** saves everything, the current game or the current profile to a file. **Menu → Import…** or dropping a file onto the window brings it back, with a preview of what matches.
4. **Menu → Settings…** changes the data folder, restores a backup and shows the version.

## Development

Requirements: Node.js 24, npm.

```bash
npm install        # dependencies
npm run dev        # dev server, http://localhost:5173
npm run build      # production build into dist/
npm run preview    # serve the build, http://localhost:4173/hotkey-map/
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm test           # unit and component tests (Vitest)
npm run e2e        # end-to-end tests in Chromium and Firefox (Playwright)
npm run e2e:pwa    # build, then check the service worker and offline mode
npm run perf       # selection speed, see docs/perf-selection.md
```

For e2e tests the dev build accepts `?storage=browser`: it keeps data in IndexedDB even in Chrome, because Playwright cannot use the system folder picker. The production build ignores it.

Use a separate data folder for development: the dev server and GitHub Pages are different sites, and each has its own folder permission.

## Build and deploy

`npm run build` writes static files to `dist/` with the base path `/hotkey-map/`. Every push to `main` runs lint, format check, type check, unit tests and the build in GitHub Actions, then publishes `dist/` to GitHub Pages. Other branches and pull requests run the same checks without deploying.

App icons are generated from `public/icon.svg` with `npm run pwa-assets`.

## Tech stack

TypeScript, React, Vite, Zustand + zundo, Tailwind CSS, shadcn/ui (Radix UI), Zod, vite-plugin-pwa, Vitest, Testing Library, Playwright.

## Documentation

- [`docs/TZ.md`](docs/TZ.md) — requirements (in Russian)
- [`docs/manual-checklist.md`](docs/manual-checklist.md) — release checklist
- [`docs/perf-selection.md`](docs/perf-selection.md) — selection speed measurements

## License

[MIT](LICENSE)
