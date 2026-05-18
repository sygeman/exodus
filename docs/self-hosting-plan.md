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

## Текущий baseline в репозитории

На момент старта в репозитории уже есть минимальный self-hosting baseline:

- манифесты находятся в `apps/exodus/edem-manifests`
- генерация запускается только через `bun run codegen` из корня репозитория
- output-таргет — `apps/exodus-generated`
- parity-скрипт находится в `packages/edem-codegen/compare.ts`
- текущий IR и validate живут в `packages/edem-codegen/src/ir.ts` и `packages/edem-codegen/src/validate.ts`
- app-stage уже умеет генерировать базовые `.vue`-компоненты и `registry.ts` из `packages/edem-codegen/src/stages/app`
- parity-классификация и её тесты вынесены в `packages/edem-codegen/src/compare.ts` и `packages/edem-codegen/src/compare.test.ts`

## Операционные правила

- единственный поддерживаемый способ регенерации `apps/exodus-generated` — `bun run codegen` из корня репозитория
- не запускать генерацию обходными путями через `packages/edem-codegen/generate.ts`, `compare.ts --generate` или ручные команды внутри `apps/exodus-generated`, кроме случаев отдельной инфраструктурной отладки с явным решением команды
- `apps/exodus` остаётся эталоном для parity-сравнения, пока не согласовано иное
- запрещено подгонять `apps/exodus` под текущий generated output без явного одобрения; сначала нужно исправлять schema, manifests, codegen или parity tooling
- если возникает соблазн «срезать угол» правкой reference-кода ради зелёного parity, это считается invalid progress, пока не зафиксировано отдельное решение о смене эталона

Это означает, что задача не в создании системы с нуля, а в переходе от базовой генерации leaf-компонентов к полному self-hosting shell-уровня `Exodus`.

## Что сейчас уже есть, а чего не хватает

Уже есть:

- data/flows/routes/assets manifest pipeline
- базовый IR для компонентов, маршрутов, коллекций, flows, assets, platform
- генерация компонентных файлов
- примитивный component registry
- parity report между `apps/exodus` и `apps/exodus-generated` с группировкой по областям и классификацией причин
- unit-тесты на parity classification layer
- генерация `package.json` без `bun add` / `bun install` внутри generated app

Пока не хватает:

- capability inventory по реальным экранам `Exodus`
- явной schema для local state / computed / actions / queries / layouts
- wrapper metadata для внешних компонентов
- route-shell и nested-layout генерации как first-class части pipeline
- validation для state/action/wrapper contract'ов
- исправления icon/assets pipeline, чтобы генерация platform icons не падала на generated app
- реального vertical slice, который проходит parity не только на уровне отчёта, но и на уровне поведения

## Текущий статус реализации

Уже реализовано:

- `compare.ts` больше не является простым файловым `diff`
- parity-инструмент умеет при необходимости регенерировать `apps/exodus-generated`
- parity-инструмент умеет выдавать текстовый и `--json` отчёт
- расхождения группируются по `shell`, `layouts`, `pages`, `assets`, `other`
- расхождения классифицируются как `schema gap`, `generator gap`, `migration gap`
- генератор больше не зависит от `bun add` / `bun install` внутри output-проекта
- pipeline генерации иконок больше не падает из-за относительных `asset`-путей в generated app
- app-stage умеет прокидывать обычные manifest action handlers в template events, включая события с modifier'ами вроде `keyup.enter`
- app-stage умеет импортировать локальные manifest-компоненты, используемые внутри других generated components
- для первого product slice добавлены manifest-компоненты `MenuLayout` и `SettingsLayout`, а `ProjectSettingsPage` переведён на их использование
- data-stage теперь генерирует shared runtime layer: `src/data-manifest.ts`, `src/edem-client.ts`, `src/hooks.ts`

Проверено фактическим прогоном:

- `bun run codegen` запускает полный поддерживаемый цикл генерации и parity-проверки
- текущий parity baseline после последних прогонов `bun run codegen`: `87` расхождений

Текущие известные блокеры:

- shell/layout/page parity по-прежнему в основном находится в зоне `generator gap`
- часть расхождений относится к `schema gap`, то есть не лечится только правками codegen
- первая settings chain уже закрыта в parity, а `FlowSettingsPage` и `SettingsAppearance` больше не попадают в page-level generator gap
- settings slice всё ещё не завершён end-to-end: главным ближайшим хвостом в этом кластере остаётся `SettingsLanguage`, а более широкий остаток по-прежнему сидит в shell/layout/page коде и reference-only runtime/UI слоях

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

Артефакты этапа:

- capability matrix по всем основным экранам `Exodus`
- список `must-have` возможностей для self-hosting v1
- список `external-only` сценариев, которые не должны попадать в native DSL
- список экранов-кандидатов для первой manifest-driven миграции

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

Артефакты этапа:

- письменная таблица `capability -> native | external`
- набор правил эскалации, чтобы новые фичи не размывали границу DSL
- список конкретных компонентов `Exodus`, которые должны жить как wrappers

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

Артефакты этапа:

- новая или расширенная schema UI-манифестов
- примеры manifest-описания для минимум одного list-page и одного form-page
- обновлённый контракт документации в `docs/ui.md` и связанных README

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

Минимальный контракт wrapper model:

- `source` — откуда импортируется компонент
- `export` — default/named export
- `name` — публичное имя в Edem registry
- `props` — декларация допустимых props и их типов
- `events` — перечень событий и форма payload
- `model` — optional `v-model`-подобные bindings
- `slots` — поддерживаемые slot'ы
- `assets` — связанные стили, иконки, адаптеры
- `renderer` — optional target-specific metadata, если без неё нельзя обойтись

Артефакты этапа:

- schema wrapper metadata
- 1-2 референсных wrapper-примера на реальных компонентах `Exodus`
- правила генерации imports/registry/assets для wrapper'ов

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

Артефакты этапа:

- обновлённые типы в `packages/edem-codegen/src/ir.ts`
- расширенный validate pipeline в `packages/edem-codegen/src/validate.ts`
- диагностические ошибки, которые указывают не только место, но и нарушенный контракт

### 6. Codegen Redesign

Когда schema и IR стабилизированы, pipeline обновляется в таком порядке:

1. imports и registry для внешних компонентов
2. shell-уровень: `App.vue`, router, layouts
3. leaf-pages и обычные form/list pages
4. local state, query glue, actions
5. wrapper integration вокруг сложных компонентов

Codegen должен генерировать orchestration-код, а не заменять внутреннюю реализацию внешних компонентов.

Артефакты этапа:

- генерация imports и registry из wrapper metadata
- генерация shell-слоя приложения
- генерация layout-слоя и route nesting
- генерация action/state/query glue code
- генерация wrapper integration без ручных вставок в generated app
- генерация финального `package.json` без runtime-вызовов package manager внутри output-проекта

### 7. Parity Tooling

`compare.ts` должен стать инструментом контроля прогресса, а не просто файловым `diff`.

Статус: базовая реализация уже сделана.

Он должен:

- генерировать или проверять наличие `apps/exodus-generated`
- сравнивать generated и reference по группам: shell, layouts, pages, assets
- показывать coverage по manifest-driven частям приложения
- классифицировать расхождения: `schema gap`, `generator gap`, `migration gap`

Артефакты этапа:

- новая версия `packages/edem-codegen/compare.ts`
- machine-readable parity report
- человекочитаемый статус по областям приложения
- unit-тесты на classification и aggregation parity-логики

## Очередность внедрения

### Этап A. Архитектура

1. Зафиксировать философию `composition + wrappers`
2. Собрать capability matrix по `Exodus`
3. Зафиксировать boundary между native Edem UI и external packages

Definition of done:

- понятно, какие возможности блокируют self-hosting прямо сейчас
- для каждой спорной capability принято решение `native` или `external`
- выбран первый экран или vertical slice для миграции

### Этап B. Schema

1. Расширить UI schema для state/data/actions/layouts
2. Спроектировать wrapper model для внешних компонентов
3. Обновить документацию и контракт UI-манифестов

Definition of done:

- schema покрывает минимальный набор для первого vertical slice
- есть хотя бы один валидный manifest-пример нового формата
- нет необходимости писать framework-specific код внутри manifest'а

### Этап C. Pipeline

1. Расширить IR
2. Переписать validate
3. Обновить app/vue/codegen stages
4. Научить pipeline генерировать shell и layout-слой

Definition of done:

- `edem-codegen` собирает vertical slice end-to-end
- generated output не требует ручной дописки glue code
- validation падает на некорректных wrapper/state/action связях заранее

### Этап D. Parity

1. Усилить `compare.ts`
2. Ввести сравнение generated и reference по областям
3. Сделать отчёт о текущем parity status

Definition of done:

- parity-инструмент показывает не только diff, но и класс проблемы
- можно отдельно оценить готовность shell, layouts, pages и assets
- видно, какие расхождения исправляются schema-работой, а какие миграцией экранов

Статус сейчас:

- базовый DoD этапа D уже достигнут
- этап не закрыт полностью только потому, что parity report ещё не используется как регулярный KPI по конкретным vertical slice

### Этап E. Migration

1. Переносить экраны Exodus на новую schema
2. Выносить сложные interactive pieces в отдельные пакеты
3. Подключать их через wrapper model

Definition of done:

- выбранные экраны больше не зависят от ручного UI-кода в `apps/exodus`
- сложные виджеты подключаются как внешние building blocks
- parity coverage растёт экран за экраном, а не только на уровне файлового diff

## Первый vertical slice

Чтобы не размазывать работу по всей системе, нужен первый узкий, но полный сценарий. Хороший кандидат должен:

- иметь route
- использовать layout shell
- читать данные из collection или singleton
- иметь хотя бы одно локальное состояние
- вызывать хотя бы одно action или flow
- не зависеть от самого сложного imperative widget

Цель первого slice:

- проверить schema state/data/actions/layouts на реальном экране
- проверить, что IR и validate держат этот контракт
- проверить, что codegen собирает экран без ручной дописки
- получить baseline для parity-отчёта

Выбранный кандидат для первого product slice: `ProjectSettingsPage`.

Почему именно он:

- экран находится на реальном nested route: `/project/:id/settings`
- использует layout shell через `SettingsLayout`
- читает данные проекта по route param
- имеет локальное состояние `deleteModalOpen`
- выполняет реальные actions: update, delete, navigate
- остаётся достаточно узким и не зависит от graph/canvas widget'ов

Минимальный capability-gap для `ProjectSettingsPage`:

- layout DSL должен уметь описывать nested settings-layout с nav items и page title
- data DSL должен уметь связывать route params с collection query и derived `project`
- state DSL должен покрывать локальный modal state
- actions DSL должен покрывать update field, delete entity, close modal и navigation после delete
- view DSL должен уметь описывать conditional rendering для `project` / `!loading`
- wrapper contract должен покрывать используемые `UInput`, `UButton`, `UModal`, `UIcon`

Статус после текущей фазы:

- layout-компоненты `MenuLayout` и `SettingsLayout` уже описаны манифестами
- `ProjectSettingsPage` уже использует `if` / `elseIf`, modal DSL и обычные manifest actions вместо ручной template-вёрстки только в reference app
- codegen уже умеет выводить такие handler'ы в template, включая `blur`, `click` и `keyup.enter`
- generated app теперь воспроизводит и shared runtime layer первого slice через `data-manifest.ts`, `edem-client.ts` и `hooks.ts`
- первая settings chain уже закрыта в parity: `MenuLayout`, `SettingsLayout` и `ProjectSettingsPage` больше не попадают в page/layout diff
- `FlowSettingsPage` и `SettingsAppearance` тоже выведены из page-level generator gap, что снизило общий parity baseline до `87`
- end-to-end parity для settings-кластера ещё не достигнут, потому что `SettingsLanguage` всё ещё расходится, а помимо него остаются другие generated shell/layout/page различия и reference-only runtime/UI слои

До тех пор, пока первый vertical slice не проходит end-to-end, расширять DSL дальше не стоит.

Практический вывод после первых прогонов: отдельный technical slice на генератор и parity tooling уже был нужен и уже реализован. Следующий slice должен быть не инфраструктурным, а продуктовым: один реальный экран `Exodus`, который проходит через route, layout, data binding и action без ручных правок generated app.

## Ближайшие шаги

1. Добить parity для `SettingsLanguage`, чтобы закрыть ближайший остаток settings-кластера
2. После этого расширить тот же подход на следующий manifest-driven page gap из того же семейства экранов
3. Вынести следующий слой reference-only runtime/UI контрактов, которые ещё мешают parity (`types/flow`, `persist-route`, `apply-theme`, wrapper-компоненты)
4. Обновлять parity baseline после каждого замкнутого шага, а не после больших пачек изменений

## Порядок реальной реализации

Практически работу лучше вести не слоями в полном отрыве, а короткими замкнутыми циклами:

1. выбрать первый экран
2. собрать capability-gap именно для него
3. расширить schema только под этот минимальный набор
4. протащить изменения через IR, validate и codegen
5. добиться parity для этого экрана
6. только после этого обобщать решение на остальные экраны

Такой порядок снижает риск спроектировать слишком широкий DSL без проверки на реальном `Exodus`.

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
