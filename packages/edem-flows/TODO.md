# TODO — edem-flows

Незавершённые и проблемные места в текущей реализации.

---

## Высокий приоритет

### 1. ~~`nodeStarted` / `nodeCompleted` — мёртвые подписки~~ ✅

Подписки эмитятся в lifecycle callbacks (runFlow, resumeRun, handleNodeCompleted).

### 2. ~~`subflow` — нет валидации max depth~~ ✅

При создании child run проверяется `parent_run_id` цепочка. Ошибка при `depth >= 10`.

### 3. `fork`/`join` — join не ждёт ветки

Fork выполняет ветки через `Promise.all` (`engine.ts:234`). Если ветка содержит async node (action, loop), `Promise.all` вернёт `waiting` при первой же async ветке, а остальные ветки не выполнятся.

Join executor (`executors.ts:282`) просто агрегирует `input`, не имея механизма ожидания внешнего завершения веток.

**Реализация:** реализовать полноценный async fork с сохранением состояния веток.

### 4. ~~Нет валидации структуры flow~~ ✅

`validateFlow()` проверяет невалидные edges (ссылки на несуществующие ноды). Осиротевшие ноды допускаются (нормально для draft flows).

---

## Средний приоритет

### 5. `delay` — блокирует поток

`delay` executor (`executors.ts:150`) использует `setTimeout`. При длинных задержках (часы, дни) блокирует поток выполнения. Нет persistence — при рестарте процесса delay теряется.

**Реализация:** сделать `delay` async node (возвращать `status: "async"`), сохранять `resume_at` timestamp, возобновлять через scheduler/dispatcher.

### 6. `output` — не сохраняет в `FlowRun.output`

`output` executor возвращает resolved outputs как node output (`executors.ts:192`). `FlowRun.output` устанавливается как `result.context.node_outputs` (все выходы всех нод), а не конкретный output ноды.

**Реализация:** изменить `FlowRun.output` на конкретный output ноды типа `output`.

### 7. `action` / `subflow` — нет таймаута для `waiting`

Если registered handler не найден (action) или subflow не завершается, run остаётся в `waiting` навсегда.

**Реализация:** добавить опциональный `timeout` на async nodes. При истечении — автоматически вызывать `handleNodeFailed`.

### 8. Backpressure — race condition

Проверка backpressure (`index.ts:202-226`) происходит до создания run. Два параллельных `runFlow` могут пройти проверку одновременно и превысить лимит.

**Реализация:** либо использовать атомарную операцию, либо проверять backpressure после создания run и откатывать при превышении.

### 9. ~~Scheduler — нет `stopScheduler()`~~ ✅

`startScheduler()` возвращает `{ stop() }` функцию, которая очищает все таймеры и отписывается от событий.

### 10. Silent `.catch(console.error)` в dispatcher/scheduler

Ошибки при запуске flows глотаются (`dispatcher.ts:109`, `scheduler.ts:54`). Нет retry, нет error propagation, нет dead-letter.

**Реализация:** добавить retry с exponential backoff или event emitter для ошибок.

---

## Низкий приоритет

### 11. `loop` — не self-executing

Loop executor трекает итерации через `flow_variables`, но каждая итерация требует внешнего вызова `handleNodeCompleted`. Loop не выполняется автономно.

**Реализация:** рассмотреть auto-iteration模式 (internal loop с scheduler для каждой итерации).

### 12. ~~`input` нода — требует `trigger_data.inputs`~~ ✅

`input` executor поддерживает оба варианта: `trigger_data.inputs` и `trigger_data` напрямую.

### 13. ~~`applyManifest` — `manifest_id` не в схеме коллекции~~ ✅

`manifest_id` добавлен в fields коллекции `flows`.

### 14. `listFlows` — нет фильтрации

Edem module system не поддерживает optional inputs в query. Фильтрация возможна на стороне клиента.

### 15. Покрытие тестами

Нет тестов для:
- `resumeRun` mutation
- Concurrent runs с backpressure
- `join` с `onError` конфигурацией
- Scheduler edge cases (drift, teardown)
- Dispatcher collection filtering
