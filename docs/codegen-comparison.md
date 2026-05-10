# Exodus vs Generated — Comparison

## Критичное

| Что | Где сейчас | Описание |
|-----|-----------|----------|
| **i18n** | `src/locales/` + `modules/*/i18n/` (~40 файлов) | `vue-i18n`, merged locale files, `resolveLocale`, `defaultLocale` |
| **Logger system** | `modules/logger/` (6 файлов + composables) | Zod-типы, dedup, query/stats, webview+bun loggers, `useLogger` composable |
| **App state** | `composables/useAppState.ts` | Route restoration, system locale/theme watching, `edemBridge.emitEvent` |
| **Error handling** | `src/main.ts` lines 62-75 | Global `error`/`unhandledrejection` listeners |
| **Webview logger init** | `src/main.ts` line 58 | `webviewLogger.init()` |
| **`__APP_VERSION__`** | `vite.config.ts` + `env.d.ts` | Build-time version injection |

## Важное

| Что | Где сейчас | Описание |
|-----|-----------|----------|
| **Modal routing** | `composables/useModalRoute.ts` | Modal state via URL query params |
| **Collection labels** | `composables/useCollectionLabels.ts` | Динамические i18n-лейблы из data.json |
| **useLogger** | `modules/logger/composables/useLogger.ts` | Пагинация, фильтры, stats, pause/resume, subscriptions |
| **useUpdaterStatus** | `modules/updater/composables/useUpdaterStatus.ts` | Singleton pattern, listener counting |
| **Typed composables** | `modules/projects/webview.ts` | `useProjects()`, `useProject()`, `useIdeas()` с полным CRUD |
| **Projects constants** | `modules/projects/constants.ts` | `PROJECT_COLORS` array |
| **Level colors** | `modules/projects/composables/useLevelColor.ts` | Цвета уровней для идей |

## Менее критичное

| Что | Описание |
|-----|----------|
| **Shared tsconfig** | `extends: "@exodus/typescript-config/tsconfig"` |
| **Release config** | `release.baseUrl`, `release.generatePatch` |
| **Linux icon** | `build.linux.icon` в electrobun config |
| **Missing deps** | `@vueuse/core`, `vue-i18n`, `@vue-flow/*`, `dagre`, `drizzle-orm` |
| **CSS utility** | `.scrollbar-hidden` class |
| **Settings persistence** | `edemBridge.emitEvent("app-state:setting-changed", ...)` |

## Уже покрыто codegen

| Что | Статус |
|-----|--------|
| Splash screen | ✓ `platform.json` → `splash` feature |
| Assets (logo.svg) | ✓ `assets.json` → импорт в компонентах |
| Electrobun scripts | ✓ `electrobunStage` копирует scripts/ |
| Platform features | ✓ logger, updater, app-state, devtools |
| Routes и components | ✓ `routes.json` + `components/*.json` |
| Data composables | ✓ `data.json` → `useCollection` composables |
