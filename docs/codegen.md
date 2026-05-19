# Слой генерации (Codegen)

Build-time слой подготовки manifests, metadata и runtime glue. Codegen остаётся важной частью системы, но не является целевой машиной генерации экранных `.vue`-страниц.

← [Edem](./edem.md) · Реализация: [edem-codegen](../packages/edem-codegen/README.md)

## Роль слоя

Codegen нужен для того, чтобы подготовить приложение к runtime-исполнению manifests:

- собрать manifests
- построить `IR`
- провалидировать контракты
- подготовить metadata для runtime
- собрать route tables и registry metadata
- подготовить platform glue

Целевая архитектура self-hosting не должна зависеть от generated `.vue`-экранов.

## Pipeline

```text
Манифесты -> Парсинг -> IR -> Валидация -> Runtime Artifacts
```

Где runtime artifacts могут включать:

- manifest bundles
- type artifacts
- route metadata
- component registry metadata
- wrapper metadata
- platform/runtime bootstrap files

## Что codegen обязан делать

1. **Парсинг**
- читать UI, flow, route, data, asset manifests
- строить типизированное промежуточное представление

2. **Валидация**
- проверять перекрёстные ссылки
- валидировать contracts для state, queries, flows, wrappers и layouts
- падать раньше runtime там, где нарушение можно поймать на build-time

3. **Сборка runtime metadata**
- route tables
- component registry declarations
- wrapper import metadata
- type-safe manifest bundles

4. **Platform glue**
- bootstrap runtime
- platform-specific configuration
- packaging metadata

## Что codegen не должен быть обязан делать

- генерировать экранные `.vue`-страницы как основную форму исполнения
- генерировать bespoke imperative handlers для экранной логики
- подменять screen runtime большим количеством framework-specific glue code
- повторно реализовывать сложные внешние компоненты

## IR

IR должен выражать фактический runtime contract, а не только удобства текущей генерации.

Минимально IR должен уметь хранить:

- component tree
- routes, layouts и shell metadata
- query/state/computed declarations
- event -> flow bindings
- wrapper contracts
- flow profile metadata
- platform metadata

## Валидация

Validation должна проверять не только структуру файлов, но и архитектурный контракт.

Примеры:

- route ссылается на существующий экран или layout
- UI event ссылается на существующий flow
- wrapper contract совместим с declared props/events/model
- `ui-action` flow не использует запрещённые node types
- layout и screen composition корректны для target runtime

## Wrapper Model

Codegen должен понимать first-class metadata внешних компонентов:

- `source`
- `export`
- `name`
- `props`
- `events`
- `model`
- `slots`
- optional renderer/platform metadata

Это позволяет runtime использовать npm/internal components как black-box building blocks без генерации их внутренней логики.

## Route, Shell и Layout Metadata

Codegen должен уметь собирать:

- route tables
- nested layout relations
- shell-level composition metadata
- navigation metadata, если она нужна runtime

Но shell/layout не обязаны материализоваться как generated `.vue`-files. Целевой результат — корректная runtime-композиция.

## Flow Metadata

Codegen должен подготавливать flow artifacts для runtime:

- flow manifests
- profile metadata (`ui-action`, `domain`, `system`)
- node capability metadata
- validation artifacts

Ключевая задача — не породить handler-код, а обеспечить runtime достаточной структурированной информацией для исполнения поведения.

## Runtime-first следствие

Если экран целиком описан через:

- `ui manifest`
- `flow manifest`
- wrapper registry

то codegen не обязан производить page-SFC. Он должен произвести всё необходимое для честного runtime-исполнения.

## Migration Tooling

На переходном этапе codegen может продолжать поддерживать generated output и сравнение с reference app.

Это допустимо как миграционный инструмент для:

- сравнения coverage
- поиска schema/runtime gap
- контроля регрессий в переходный период

Но generated output не должен диктовать целевую архитектуру.

## Compare и generated app

`compare.ts` и `apps/exodus-generated` полезны для миграции, но не являются определением self-hosting.

Их задача:

- помогать локализовать пробелы
- измерять миграционный прогресс
- контролировать совпадение там, где это всё ещё важно

Их не задача:

- определять основную архитектурную форму экрана
- закреплять generated `.vue` как обязательный output

## Ключевое свойство

Практическая цель codegen — не «сгенерировать всё любой ценой», а подготовить manifests и runtime contract так, чтобы приложение собиралось и исполнялось честно, предсказуемо и без скрытого imperative glue.
