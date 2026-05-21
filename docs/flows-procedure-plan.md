# План Перехода К Procedure-Backed Flow Model

Этот документ фиксирует план перехода `edem-flows` к модели, где flow описывается как orchestration над общим каталогом Edem-процедур, а IDE редактирует source-модель, а не runtime-состояние движка.

## Зафиксированные Решения

- источник истины для flow находится в project data или manifest-артефактах
- `edem-flows` является runtime установленной модели, а не primary API authoring
- граница между authoring и execution проходит через install/apply step
- `applyManifest` является базовой точкой установки flow в runtime
- любая `query` и `mutation` должна быть доступна как callable node
- любая `subscription` должна быть доступна как event trigger source
- `manual` и `schedule` являются встроенными trigger sources того же уровня
- `action` и top-level `trigger` считаются legacy-представлением, а не целевой моделью
- draft flow в IDE не обязан исполняться через реальный `edem-flows` runtime

## Цели

- свести flow runtime к единому Edem-контракту `query / mutation / subscription`
- убрать special-case `action` из целевой модели
- убрать раздвоение между top-level `trigger` и graph trigger node
- сделать procedure catalog first-class metadata-контрактом Edem
- отделить source flow model от installed runtime flow model
- перевести editor и codegen на shared flow schema вместо локальных дубликатов

## Не Цели Первой Итерации

- не делать live-updating catalog процедур
- не строить полноценное исполнение draft flow внутри IDE
- не переводить все topology-dependent primitives в обычные module procedures за один шаг
- не держать две равноправные целевые модели flow
- не проектировать архитектуру под нужды одного только `Exodus`

## Целевая Модель

```text
Source Flow -> validate/normalize -> install/apply -> Installed Flow -> runtime execution
```

Правила:

- source flow редактируется IDE и хранится в проекте
- installed flow хранится в runtime и исполняется движком
- callable node ссылается на `module + procedure`
- event trigger node ссылается на `module + subscription`
- `manual` и `schedule` задаются как встроенные trigger sources
- execution policy вроде `timeout`, `retry` и routing живёт в flow instance, а не в модульной процедуре

## Текущий Статус

В репозитории уже выполнена первая рабочая часть перехода.

Выполнено:

- `edem-core` хранит полный metadata-контракт процедур для `query`, `mutation` и `subscription`
- `edem-core` экспортирует helpers для procedure catalog
- `edem-flows` умеет валидировать прямые procedure-backed node types вида `module.procedure`
- `edem-flows` умеет исполнять прямые procedure-backed node types
- `edem-flows` синхронизирует `trigger` и `trigger.data.source` для обычных flow
- `dispatcher` и `scheduler` уже умеют читать trigger source из graph nodes
- в `Exodus` project-facing flow editor уже отделён от runtime collection через отдельную source collection `project_flows`
- в `Exodus` появился source-to-manifest helper для project flow records
- в `Exodus` появился scoped install path `source -> FlowsManifest -> applyManifest({ project_id })`
- в `Exodus` новые graph-узлы по умолчанию создаются как `call`, а не как legacy `action`
- в `Exodus` editor получает procedure catalog из `edem-flows` без нового app-level runtime модуля
- в `Exodus` source-model validation для `project_flows` уже проверяет callable refs и trigger config до install/apply
- `module.subscription` может использоваться как event trigger source через общий dispatcher path
- новые persisted `flows` и `project_flows` больше не целятся в top-level `trigger`; source/runtime читают trigger из graph trigger node с legacy fallback
- в `Exodus` появился design-time preview для trigger/input/condition/transform/switch/output без вызова runtime процедур
- старые source flow records нормализуются в editor/install path: top-level `trigger` materialize-ится в graph node, procedure-backed `action` переводится в `call`
- `edem-flows` валидирует schedule config и dotted event refs вида `module.subscription`
- procedure-backed legacy `action` уже нормализуется в `call` в source/runtime path, когда ref разрешается через общий catalog

Сделано частично:

- target flow schema поддержана через совместимость, но legacy shape всё ещё принимается и частично экспортируется
- graph-first trigger model уже является persisted source/runtime path, но top-level `trigger` ещё остаётся compatibility-view и fallback для старых записей
- `action` всё ещё остаётся compatibility-форматом для non-catalog legacy nodes и старых внешних shape
- editor использует procedure catalog для `call` и `event` authoring path, а старые source records автоматически подтягиваются к target shape при открытии и install
- design-time preview ограничен pure-node path и намеренно не исполняет procedure calls, subflow, loop, fork/join и delay
- дальнейший `edem-codegen` alignment сознательно выведен из текущего объёма работ и не является ближайшим шагом

Следующий основной шаг:

- при возврате tooling/codegen в scope добить финальный legacy cleanup и убрать remaining compatibility export/fallback слои

## Этапы

1. Довести `edem-core` до полного metadata-контракта процедур. Статус: выполнено.

Нужно:

- сохранять полный descriptor процедуры на уровне module definition и runtime registration
- не терять `output` schema у `query` и `mutation`
- не терять payload schema у `subscription`
- дать публичный helper для перечисления процедур модуля и их metadata
- покрыть это тестами

Результат этапа:

- Edem может отдать полный каталог процедур без участия `edem-flows`

2. Ввести one-shot design-time catalog. Статус: выполнено.

Нужно:

- собирать каталог из уже известных module definitions
- включать туда все `query` и `mutation` как callable entries
- включать туда все `subscription` как event trigger entries
- добавлять встроенные `manual` и `schedule`
- использовать этот каталог как источник palette и validation metadata

Результат этапа:

- editor и tooling больше не зависят от hardcoded списка нод

3. Перевести `edem-flows` schema на target-модель. Статус: выполнено для persisted source/runtime path, compatibility export ещё остаётся.

Нужно:

- ввести явную форму callable node с процедурной ссылкой
- ввести явную форму trigger node source
- оставить legacy shape только как входной формат
- нормализовать legacy shape в target shape до сохранения и исполнения

Результат этапа:

- persisted flow model становится одной и той же для install и runtime

4. Сделать legacy normalizer. Статус: частично выполнено.

Нужно:

- преобразовывать `action` в callable procedure ref
- преобразовывать top-level `trigger` в trigger node
- не сохранять legacy shape как равноправный target format

Результат этапа:

- возможна миграция без поддержки двух независимых runtime-путей

5. Внедрить generic procedure call path в `edem-flows` runtime. Статус: выполнено для прямых procedure-backed nodes и procedure-backed legacy `action`; non-catalog legacy `action` остаётся compatibility-path.

Нужно:

- собрать input для callable node
- вызвать `edem[module][procedure](input)`
- сохранить output в node output
- продолжить обход графа без special-case `action`

Результат этапа:

- любые `query` и `mutation` реально исполнимы как flow nodes

6. Перевести trigger system на graph-first модель. Статус: выполнено для persisted/runtime path, compatibility fallback/export ещё остаётся.

Нужно:

- убрать top-level `trigger` из целевой runtime-модели
- оставить один entry boundary node для `flow`
- привязать event trigger nodes к `subscription`
- привязать schedule runtime к trigger nodes типа `schedule`
- сохранить `manual` как встроенный trigger source

Результат этапа:

- launch model и graph model больше не дублируют друг друга

7. Усилить validation в `edem-flows`. Статус: выполнено для current source/runtime model.

Нужно:

- проверять существование referenced `module/procedure`
- проверять, что callable node ссылается только на `query` или `mutation`
- проверять, что event trigger ссылается только на `subscription`
- валидировать конфиг `schedule`
- валидировать единственную entry trigger node для `flow`

Результат этапа:

- design-time и runtime смотрят на один и тот же контракт

8. Переписать dispatcher и scheduler под новую trigger model. Статус: выполнено.

Нужно:

- индексировать event triggers по subscription references
- запускать schedule flows по trigger nodes типа `schedule`
- не опираться на старую top-level trigger schema

Результат этапа:

- trigger runtime соответствует target manifest model

9. Синхронизировать `edem-codegen` со shared flow schema. Статус: частично выполнено, дальнейшие изменения отложены вне текущей итерации.

Нужно:

- убрать устаревшие assumptions о top-level `trigger`
- перестать считать trigger отдельным обязательным top-level полем IR
- исправить generated runtime calls на реальный API
- сохранить модульные границы и не вводить новые прямые runtime-импорты между модулями

Результат этапа:

- codegen и runtime перестают расходиться по форме flow

10. Подключить authoring-режим в IDE к source flow model. Статус: выполнено для current editor path, кроме финального legacy cleanup/tooling tail.

Нужно:

- редактировать flow как проектный артефакт
- использовать procedure catalog для palette и validation без добавления лишнего app-level runtime модуля
- отделить save source model от install/apply step
- сделать `call` основным authoring path, а `action` оставить только как совместимый legacy-editing слой
- не использовать runtime CRUD `edem-flows` как основной authoring path
- не добавлять legacy migration как постоянный архитектурный слой

Результат этапа:

- IDE работает как редактор исходников flow, а не как thin client runtime-движка

11. Опционально добавить design-time эмуляцию. Статус: частично выполнено.

Нужно:

- ограничить её topology validation, input mapping preview и pure-node preview
- не запускать реальные side effects и runtime flows
- не связывать editor loop с `dispatcher`, `scheduler` и реальными module procedures

Результат этапа:

- IDE может помогать с пониманием flow без подмены runtime

12. Убрать legacy после миграции manifests и tooling. Статус: не начато.

Нужно:

- перевести существующие manifests на target shape
- перевести editor и codegen на новую модель
- убрать временные adapters только после закрытия миграции

Результат этапа:

- в системе остается одна фактическая модель flow

## Оставшийся Приоритет Выполнения

1. расширить optional design-time эмуляцию без выхода в реальный runtime
2. cleanup legacy после возврата manifests/tooling в target shape
3. `edem-codegen` alignment completion после возврата этой задачи в scope

## Изменения По Пакетам

### `packages/edem-core`

- хранить полный descriptor процедуры
- экспортировать helper для procedure catalog
- не ограничиваться только `getModuleSubscriptions`

### `packages/edem-flows`

- перейти на target flow schema
- нормализовать legacy `action` и top-level `trigger`
- вызывать процедуры через generic call path
- использовать trigger nodes как entry model

### `packages/edem-codegen`

- убрать локальную flow shape
- перейти на shared flow schema
- исправить assumptions о trigger и runtime API

### `packages/edem-ui`

- сохранить `event -> flow` как target contract
- держать `actions` только как миграционный слой

### `apps/exodus`

- редактировать только source flow model
- хранить проектные flow в `project_flows`, а runtime flow в `flows`
- использовать catalog процедур для palette и validation
- отделить install/apply от editor save loop
- нормализовать legacy source records в graph-first shape на editor/install path
- держать design-time preview только для pure-node path без side effects

## Главные Риски

- снова смешать source authoring и runtime execution
- попытаться перевести все built-in graph primitives в procedures в первой же волне
- сохранить две равноправные модели flow слишком надолго
- продолжить дублировать flow schema в codegen и runtime
- завязать editor на реальное исполнение draft flow

## Definition Of Done

- существует единый procedure catalog для Edem-модулей
- любая `query` и `mutation` доступна как callable node
- любая `subscription` доступна как event trigger source
- `manual` и `schedule` встроены в ту же trigger model
- `action` больше не является целевой persisted-сущностью
- top-level `trigger` больше не является целевой persisted-сущностью
- `applyManifest` используется как install boundary между source и runtime
- `edem-codegen` использует shared flow schema
- IDE редактирует source flow model, а не runtime flow records
