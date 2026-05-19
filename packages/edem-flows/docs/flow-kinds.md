# Flow Kinds And Validation

Этот документ фиксирует текущий контракт схем в `@exodus/edem-flows`.

## Flow kinds

У каждого flow есть `kind`:

- `flow`
- `subflow`

## `kind: "flow"`

Инварианты:

- ровно один `trigger`
- `input` запрещён
- `output` запрещён

Назначение:

- внешний flow, который запускается runtime через trigger data

Стартовый каркас при создании или reset:

```ts
{
  kind: "flow",
  trigger: { type: "manual" },
  nodes: [{ id: "trigger", type: "trigger", position: { x: 0, y: 0 } }],
  edges: [],
}
```

## `kind: "subflow"`

Инварианты:

- `trigger` запрещён
- ровно один `input`
- ровно один `output`
- должен существовать путь `input -> output`

Назначение:

- вызываемый flow, который может быть запущен только из `subflow`-ноды родительского flow

Стартовый каркас при создании или reset:

```ts
{
  kind: "subflow",
  nodes: [
    { id: "input", type: "input", position: { x: 0, y: 0 } },
    { id: "output", type: "output", position: { x: 240, y: 0 }, data: { outputs: {} } },
  ],
  edges: [{ id: "input-output", source: "input", target: "output" }],
}
```

`input` и `output` считаются системными boundary nodes. UI не должен позволять их удалять у `subflow`.

## Persisted validation

Валидация хранится вместе с flow:

```ts
type FlowValidationState = {
  valid: boolean
  validation_errors: string[]
}
```

Правила:

- `valid` и `validation_errors` вычисляются только движком
- клиент не должен присылать их вручную
- пересчёт происходит при каждом сохранении `nodes`, `edges` или `kind`
- перед `runFlow` runtime всё равно повторно вызывает `validateFlow`

## Kind reset

Смена `kind` не конвертирует текущий граф.

Поведение:

- текущие `nodes` удаляются
- текущие `edges` удаляются
- создаётся стартовый каркас нового `kind`

Сохраняются только совместимые поля, например:

- `name`
- `meta`
- `backpressure`

Для `subflow` поле `trigger` очищается. Для `flow` после reset ставится `trigger: { type: "manual" }`, если не передан другой trigger.

## Runtime contract

- `flow` стартует с `trigger`
- `subflow` стартует с `input`
- `subflow`-нода может ссылаться только на flow с `kind: "subflow"`
- результат `subflow` возвращается через единственный `output`

## Validation checklist

`validateFlow(flow)` должен проверять:

- все `edges` ссылаются на существующие `nodes`
- в графе нет циклов
- для `flow` есть ровно один `trigger`
- для `flow` нет `input`
- для `flow` нет `output`
- для `subflow` нет `trigger`
- для `subflow` есть ровно один `input`
- для `subflow` есть ровно один `output`
- для `subflow` существует путь `input -> output`
