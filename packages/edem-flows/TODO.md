# TODO — edem-flows

Незавершённые и проблемные места в текущей реализации.

---

## Высокий приоритет

### 1. `nodeStarted` / `nodeCompleted` — мёртвые подписки

Подписки объявлены в модуле (`index.ts:88-97`), но нигде не эмитятся. Эмитятся только `runNodeStarted` / `runNodeCompleted`.

**Реализация:** добавить вызовы `emit.nodeStarted()` / `emit.nodeCompleted()` в lifecycle callbacks.

### 2. `subflow` — нет валидации max depth

Spec предполагал max depth = 10. В коде `depth: 1` хардкодится при создании child run (`index.ts:400`), но никогда не проверяется. Рекурсивный subflow вызов приведёт к бесконечному циклу.

**Реализация:** при создании child run проверять `parent_run_id` цепочку и инкрементировать `depth`. Бросать ошибку при `depth > 10`.

### 3. `fork`/`join` — join не ждёт ветки

Fork выполняет ветки через `Promise.all` (`engine.ts:234`). Если ветка содержит async node (action, loop), `Promise.all` вернёт `waiting` при первой же async ветке, а остальные ветки не выполнятся.

Join executor (`executors.ts:282`) просто агрегирует `input`, не имея机制等待 внешнего завершения веток.

**Реализация:** реализовать полноценный async fork с сохранением состояния веток.

### 4. Нет валидации структуры flow

- Нет проверки на циклы (engine молча обрезает через `visited` set)
- Нет проверки осиротевших нод (ноды, недостижимые от trigger)
- Нет проверки невалидных edges (ссылки на несуществующие ноды)
- Нет проверки наличия хотя бы одного trigger node при `runFlow`

**Реализация:** добавить `validateFlow(flow)` перед запуском execution engine.

---

## Средний приоритет

### 5. `delay` — блокирует поток

`delay` executor (`executors.ts:150`) использует `setTimeout`. При длинных задержках (часы, дни) блокирует поток выполнения. Нет persistence — при рестарте процесса delay теряется.

**Реализация:** сделать `delay` async node (возвращать `status: "async"`), сохранять `resume_at` timestamp, возобновлять через scheduler/dispatcher.

### 6. `output` — не сохраняет в `FlowRun.output`

`output` executor возвращает resolved outputs как node output (`executors.ts:192`). `FlowRun.output` устанавливается как `result.context.node_outputs` (все выходы всех нод), а не конкретный output ноды.

**Реализация:**  изменить `FlowRun.output` на конкретный output ноды типа `output`

### 7. `action` / `subflow` — нет таймаута для `waiting`

Если registered handler не найден (action) или subflow не завершается, run остаётся в `waiting` навсегда.

**Реализация:** добавить опциональный `timeout` на async nodes. При истечении — автоматически вызывать `handleNodeFailed`.

### 8. Backpressure — race condition

Проверка backpressure (`index.ts:202-226`) происходит до создания run. Два параллельных `runFlow` могут пройти проверку одновременно и превысить лимит.

**Реализация:** либо использовать атомарную операцию, либо проверять backpressure после создания run и откатывать при превышении.

### 9. Scheduler — нет `stopScheduler()`

`scheduler.ts` хранит таймеры в module-level `Map`. Нет функции остановки. При teardown модуля таймеры продолжают работать.

**Реализация:** вернуть `stopScheduler()` функцию из `startScheduler()`, которая очищает все таймеры.

### 10. Silent `.catch(console.error)` в dispatcher/scheduler

Ошибки при запуске flows глотаются (`dispatcher.ts:109`, `scheduler.ts:54`). Нет retry, нет error propagation, нет dead-letter.

**Реализация:** добавить retry с exponential backoff или event emitter для ошибок.

---

## Низкий приоритет

### 11. `loop` — не self-executing

Loop executor трекает итерации через `flow_variables`, но каждая итерация требует внешнего вызова `handleNodeCompleted`. Loop не выполняется автономно.

**Реализация:** рассмотреть auto-iteration模式 (internal loop с scheduler для каждой итерации).

### 12. `input` нода — требует `trigger_data.inputs`

`input` executor читает `context.trigger_data.inputs` (`executors.ts:170`). Вызывающий должен оборачивать данные в `{ inputs: {...} }`, что неочевидно.

**Реализация:** либо читать `trigger_data` напрямую, либо поддерживать оба варианта (с `inputs` и без).

### 13. `applyManifest` — `manifest_id` не в схеме коллекции

`manifest_id` хранится ad-hoc в `data` blob (`index.ts:1101`), но не объявлен в `ensureCollections` schema (`index.ts:1310`). Зависит от поддержки произвольных JSON полей в data layer.

**Реализация:** добавить `manifest_id` в fields коллекции `flows`.

### 14. `listFlows` — нет фильтрации

`listFlows` не принимает параметров (`index.ts:1157`). Spec предполагал `status?` фильтр.

**Реализация:** добавить опциональный `status` параметр в `listFlows`.

### 15. Покрытие тестами

Нет тестов для:
- `resumeRun` mutation
- Concurrent runs с backpressure
- `join` с `onError` конфигурацией
- Scheduler edge cases (drift, teardown)
- Dispatcher collection filtering
