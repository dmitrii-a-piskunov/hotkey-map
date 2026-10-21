# Hotkey Map

A web app that shows your game keybinds on a 3D on-screen copy of your keyboard and mouse. Keep binds and game settings for different games and players, spot conflicts at a glance, and store everything in a folder on your own computer.

> **RU:** Веб-приложение, которое показывает игровые бинды на объёмной экранной копии вашей клавиатуры и мыши. Бинды и настройки хранятся по играм и профилям игроков в папке на вашем компьютере. Подробное техническое задание — в [`docs/TZ.md`](docs/TZ.md).

## Status

Early development. Version 1.0 (MVP) in progress.

## Features (MVP)

- 3D keyboard (AULA F75, 75% ANSI) and mouse with two side buttons
- Games with actions, contexts, categories, and a settings template
- Multiple player profiles per game: binds, key combos, settings with sliders
- Explorer-style key selection, key groups, modifier layers
- Conflict detection that respects game contexts
- Data stored in a local folder (File System Access API), automatic backups
- Import and export, presets for Dota 2 and PUBG
- Light, dark, and system themes; installable as a PWA; works offline

## Requirements

- Chrome or Edge for full mode (data in a local folder)
- Firefox works in fallback mode (data stored in the browser)

## Development

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Tech stack

TypeScript, React, Vite, Zustand, Tailwind CSS, shadcn/ui, Zod, Vitest, Playwright.

## License

[MIT](LICENSE)
