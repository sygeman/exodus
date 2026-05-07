# TODO — edem-flows

Незавершённые и проблемные места в текущей реализации.

---

## Высокий приоритет

### 1. ~~`nodeStarted` / `nodeCompleted` — мёртвые подписки~~ ✅

Подписки эмитятся в lifecycle callbacks (runFlow, resumeRun, handleNodeCompleted).

### 2. ~~`subflow` — нет валидации max depth~~ ✅

При создании child run проверяется `parent_run_id` цепочка. Ошибка при `depth >= 10`.

### 3. `fork`/`join` — join не ждёт ветки

Fork выполняет ветки последовательно через `Promise.all` (`engine.ts:234`). Если ветка содержит async node (action, loop), `Promise.all` вернёт `waiting` при первой же async ветке, а остальные ветки не выполнятся.

Join executor (`executors.ts:282`) просто агрегирует `input`, не имея механизма ожидания внешнего завершения веток.

**Реализация:** Fork теперь выполняет ветки последовательно и сохраняет состояние ожидания веток в `context.flow_variables.pending_fork`. Когда ветка завершается, движок возобновляет выполнение оставшихся веток. Join проверяет наличие ожидаемых веток и возвращает `status: "async"` если не все ветки завершились.

**Ограничения:** Внешнее завершение async веток (через `handleNodeCompleted`) возобновляет только одну ветку. Параллельные async ветки требуют внешнего завершения каждой по очереди.

### 4. ~~Нет валидации структуры flow~~ ✅

`validateFlow()` проверяет невалидные edges (ссылки на несуществующие ноды). Осиротевшие ноды допускаются (нормально для draft flows).

---

## Средний приоритет

### 5. ~~`delay` — блокирует поток~~ ✅

`delay` executor теперь возвращает `status: "async"` с `resume_at` timestamp. Scheduler проверяет delayed runs каждые 10 секунд и возобновляет их по истечении времени. При рестарте процесса delay восстанавливается из сохранённого context.

### 6. ~~`output` — не сохраняет в `FlowRun.output`~~ ✅

`FlowRun.output` теперь устанавливается как конкретный output ноды типа `output` (с полем `outputs`). Если нода типа `output` не найдена, используется `context.node_outputs` как fallback.

### 7. ~~`action` / `subflow` — нет таймаута для `waiting`~~ ✅

Добавлен опциональный `timeout` на async nodes (уже существовал в `FlowNode.timeout`). При истечении — автоматически вызывать `handleNodeFailed` через scheduler. `timeout_at` сохраняется в run record при входе в `waiting` состояние.

### 8. ~~Backpressure — race condition~~ ✅

Backpressure check теперь выполняется с per-flow mutex (через `globalThis`). Проверка происходит до создания run с `>=` сравнением. Mutex блокирует параллельные `runFlow` для одного flow_id.

### 9. ~~Scheduler — нет `stopScheduler()`~~ ✅

`startScheduler()` возвращает `{ stop() }` функцию, которая очищает все таймеры и отписывается от событий.

### 10. ~~Silent `.catch(console.error)` в dispatcher/scheduler~~ ✅

Dispatcher и scheduler теперь используют `runFlowWithRetry` с exponential backoff (3 попытки, базовая задержка 1s). Ошибки логируются после исчерпания попыток.

---

## Низкий приоритет

### 11. `loop` — не self-executing

Loop executor трекает итерации через `flow_variables`, но каждая итерация требует внешнего вызова `handleNodeCompleted`. Loop не выполняется автономно.

**Реализация:** рассмотреть auto-iteration模式 (internal loop с scheduler для каждой итерации).

### 12. ~~`input` нода — требует `trigger_data.inputs`~~ ✅

`input` executor поддерживает оба варианта: `trigger_data.inputs` и `trigger_data` напрямую.

### 13. ~~`applyManifest` — `manifest_id` не в схеме коллекции~~ ✅

`manifest_id` добавлен в fields коллекции `flows`.

### 14. ~~`listFlows` — нет фильтрации~~ ✅

`listFlows` теперь поддерживает опциональные фильтры `status` и `name` (case-insensitive contains).

### 15. Покрытие тестами

Нет тестов для:
- `resumeRun` mutation
- Concurrent runs с backpressure
- `join` с `onError` конфигурацией
- Scheduler edge cases (drift, teardown)
- Dispatcher collection filtering
