# План Self-Hosting UI

Рабочий план доведения `edem-codegen` и UI-манифестов до состояния, где `Exodus` может собирать свой интерфейс сам из `edem-manifests`.

← [Edem](./edem.md) · [UI-слой](./ui.md) · [Codegen](./codegen.md)

## Цель

Цель этапа — не переизобрести UI-фреймворк, а сделать UI-манифесты достаточно выразительными для описания:

- композиции экранов
- базовой локальной логики
- route/layout shell
- привязки к данным и flows
- обёрток над внешними компонентами

Сложные интерактивные виджеты не реализуются внутри Edem заново. Они выносятся в пакеты и подключаются в манифестах как обычные компоненты.

## Архитектурная рамка

Edem UI ближе по философии к связке `Astro` + `Storybook`, чем к отдельному приложенческому фреймворку.

- **Edem описывает orchestration** — дерево компонентов, props, children, slots, состояния, события, данные, маршруты
- **Пакеты описывают сложность** — graph editors, rich widgets, контекстные меню, canvas-логика, сложные interactive systems
- **Codegen собирает glue code** — imports, registry, handlers, queries, layouts, shell

## Потоки работ

### 1. Capability Inventory

Сначала нужно собрать полную матрицу механизмов UI, которые реально используются в `Exodus`.

Категории:

- view composition
- props и slots
- local state
- computed values
- effects и lifecycle
- queries и singleton bindings
- CRUD и flow events
- navigation
- layouts и route shells
- external component wrappers

Результат этого шага — не список файлов, а список capability-gap между текущей schema и реальным приложением.

### 2. Native vs External Boundary

Для каждой capability нужно определить, где она должна жить:

- **Native Edem UI** — универсальные концепции современного UI
- **External package** — сложная специализированная логика компонента

В native-слой должны входить:

- component tree
- props
- slots
- conditions
- loops
- basic local state
- computed values
- data/query bindings
- CRUD/flow/navigation actions
- layouts

Во внешний пакет должны уходить:

- graph editors
- canvas-driven widgets
- rich imperative interactive systems
- сложные context-menu engines
- custom node/edge renderers со своей внутренней логикой

### 3. UI Manifest Schema Redesign

После инвентаризации нужно доопределить schema UI-манифестов.

Обязательные подсистемы:

- **View DSL** — components, props, children, slots, conditions, loops
- **State DSL** — локальные значения, computed, writable state
- **Data DSL** — collection queries, singleton bindings, reactive query params, totals, refetch
- **Actions DSL** — CRUD, flow triggers, navigation, local state updates, payload mapping
- **Layout DSL** — route shells, nested layouts, sidebar/topbar composition
- **Wrapper DSL** — external imports, registry, model bindings, slots, component events

Критерий качества schema: типичный экран Exodus должен описываться как манифест orchestration-уровня, без встраивания произвольного framework-specific кода.

### 4. External Component Wrapper Model

Это центральная часть всей работы.

Модель обёртки должна отвечать на вопросы:

- откуда импортировать компонент
- как его регистрировать в рендерере
- какие props он принимает
- какие events он эмитит
- какие slots поддерживает
- есть ли `v-model`-подобные bindings
- какие assets или adapters нужны рядом

Именно эта модель позволяет использовать сложные npm-компоненты внутри Edem без повторной реализации их внутреннего поведения.

### 5. IR and Validation Redesign

После стабилизации schema нужно расширить IR и validation.

IR должен уметь хранить:

- описания layouts
- описания queries и state
- imports/registry metadata для внешних компонентов
- action descriptors
- route-shell metadata

Validation должна проверять:

- ссылки на компоненты, layouts и routes
- корректность props/event bindings
- совместимость wrapper metadata
- зависимости между state, queries и actions
- unsupported combinations для target renderer

### 6. Codegen Redesign

Когда schema и IR стабилизированы, pipeline обновляется в таком порядке:

1. imports и registry для внешних компонентов
2. shell-уровень: `App.vue`, router, layouts
3. leaf-pages и обычные form/list pages
4. local state, query glue, actions
5. wrapper integration вокруг сложных компонентов

Codegen должен генерировать orchestration-код, а не заменять внутреннюю реализацию внешних компонентов.

### 7. Parity Tooling

`compare.ts` должен стать инструментом контроля прогресса, а не просто файловым `diff`.

Он должен:

- генерировать или проверять наличие `apps/exodus-generated`
- сравнивать generated и reference по группам: shell, layouts, pages, assets
- показывать coverage по manifest-driven частям приложения
- классифицировать расхождения: `schema gap`, `generator gap`, `migration gap`

## Очередность внедрения

### Этап A. Архитектура

1. Зафиксировать философию `composition + wrappers`
2. Собрать capability matrix по `Exodus`
3. Зафиксировать boundary между native Edem UI и external packages

### Этап B. Schema

1. Расширить UI schema для state/data/actions/layouts
2. Спроектировать wrapper model для внешних компонентов
3. Обновить документацию и контракт UI-манифестов

### Этап C. Pipeline

1. Расширить IR
2. Переписать validate
3. Обновить app/vue/codegen stages
4. Научить pipeline генерировать shell и layout-слой

### Этап D. Parity

1. Усилить `compare.ts`
2. Ввести сравнение generated и reference по областям
3. Сделать отчёт о текущем parity status

### Этап E. Migration

1. Переносить экраны Exodus на новую schema
2. Выносить сложные interactive pieces в отдельные пакеты
3. Подключать их через wrapper model

## Критерии готовности этапа

Этап можно считать завершённым, когда выполнены все условия:

- UI-манифесты покрывают базовые универсальные механизмы, реально нужные `Exodus`
- сложные компоненты выражаются через внешние пакеты и wrappers, а не через ad-hoc ручной код вокруг генератора
- `edem-codegen` генерирует shell, layouts и manifest-driven pages в согласованном виде
- `compare.ts` показывает понятный parity report между `apps/exodus` и `apps/exodus-generated`
- архитектурная граница между native Edem UI и external package logic зафиксирована и не размывается

## Главные риски

- попытка превратить Edem в ещё один UI-фреймворк
- попытка выразить сложный imperative widget напрямую в базовом DSL
- расширение schema без жёсткой границы ответственности
- codegen, который повторно реализует поведение внешних компонентов вместо orchestration вокруг них

## Принцип принятия решений

Если новая задача относится к универсальным концепциям современного UI, она должна идти в Edem schema.

Если новая задача относится к специализированной логике конкретного сложного компонента, она должна решаться во внешнем пакете и подключаться в Edem через wrapper model.
