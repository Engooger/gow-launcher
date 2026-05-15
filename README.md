# GoW Launcher

Самописный лаунчер для модпака God of War (Minecraft 1.21.1 + NeoForge 21.1.229).

## Запуск разработки

```bash
npm install
npm run dev       # Vite dev-сервер (http://localhost:5173)
# в другом терминале:
npm run start     # компилит electron и запускает
```

## Сборка установщика

```bash
npm run dist      # NSIS .exe в release/
```

## Публикация модпака

1. Создай GitHub репо `gow-modpack` (приватный или публичный — лаунчер качает через прямые ссылки релизов, public проще).
2. Авторизуй gh CLI: `gh auth login`.
3. Пропиши свой `user/repo` в `electron/config.ts` (`modpackRepo`) и в `scripts/publish-modpack.mjs` (`REPO`).
4. Опубликуй:

```bash
node scripts/publish-modpack.mjs --version 0.1.0 --repo USER/gow-modpack
```

Скрипт:
- зипует `mods/`, `config/`, `kubejs/` из `D:/steam/Новая папка`
- кладёт `gow.jar` отдельным компонентом (часто меняется)
- считает SHA256
- генерит `manifest.json`
- заливает всё как GitHub Release

Лаунчер на запуске тянет `manifest.json` из `latest` релиза, сверяет хеши, докачивает только что изменилось. Если интернета нет — играет на локальной версии (по `manifest.local.json`).

## Установка NeoForge

На первом запуске нужно один раз поставить NeoForge installer вручную в `%APPDATA%/.gow-launcher/minecraft`. Авто-инсталлер NeoForge — в TODO.

## Структура

- `electron/` — main process, IPC, updater, launcher
- `src/` — React UI
- `scripts/publish-modpack.mjs` — паковщик и публикатор сборки
