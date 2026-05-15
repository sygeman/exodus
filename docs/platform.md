# Платформенный слой

Абстракция среды выполнения. Отделяет приложение от конкретной платформы (desktop, web, CLI).

← [Edem](./edem.md)

## Bridge

Связь между изолированными контекстами выполнения (например, backend-процесс и UI-webview):

- **Transparent proxy** — вызовы выглядят как локальные, но выполняются в другом контексте
- **Typed messages** — запросы, ответы и события с типизированным форматом
- **Timeouts** — автоматическое завершение зависших вызовов
- **Event routing** — маршрутизация подписок по именам модулей

## System detection

Определение характеристик ОС: locale, тема (dark/light).

## Window persistence

Сохранение и восстановление геометрии окна.

## Auto-updater

Lifecycle: idle → checking → available/downloading → applying.

## Logger

Структурированное логирование с дедупликацией, меткой источника и временны́ми метками.

## Конкретные платформы

| Пакет | Среда | Описание |
|-------|-------|----------|
| [edem-electrobun](../packages/edem-electrobun/README.md) | Desktop (Bun + webview) | Bridge между Bun backend и Electrobun webview, auto-updater, system detection, logger |
| [edem-vue](../packages/edem-vue/README.md) | Web (Vue 3) | Composable-хи (Apollo-style queries/mutations), JSON→VNode renderer, i18n |

Каждый адаптер предоставляет: транспорт сообщений, маршрутизацию событий, system detection, persistence. Bridge скрывает контекст выполнения за прозрачным RPC-прокси: вызовы выглядят как локальные, но выполняются в другом процессе.

## Transparent RPC Proxy

Вызовы удалённых процедур выглядят как локальные. Сериализация, маршрутизация и десериализация скрыты за прокси-объектом.
