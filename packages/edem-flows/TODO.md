# TODO — edem-flows

Незавершённые и проблемные места в текущей реализации.

---

## Высокий приоритет

### 3. `fork`/`join` — join не ждёт ветки

Fork выполняет ветки последовательно через `Promise.all` (`engine.ts:234`). Если ветка содержит async node (action, loop), `Promise.all` вернёт `waiting` при первой же async ветке, а остальные ветки не выполнятся.

Join executor (`executors.ts:282`) просто агрегирует `input`, не имея механизма ожидания внешнего завершения веток.

**Реализация:** Fork теперь выполняет ветки последовательно и сохраняет состояние ожидания веток в `context.flow_variables.pending_fork`. Когда ветка завершается, движок возобновляет выполнение оставшихся веток. Join проверяет наличие ожидаемых веток и возвращает `status: "async"` если не все ветки завершились.

**Ограничения:** Внешнее завершение async веток (через `handleNodeCompleted`) возобновляет только одну ветку. Параллельные async ветки требуют внешнего завершения каждой по очереди.

---

## Средний приоритет

### 11. `loop` — не self-executing

Loop executor трекает итерации через `flow_variables`, но каждая итерация требует внешнего вызова `handleNodeCompleted`. Loop не выполняется автономно.

**Реализация:** рассмотреть auto-iteration模式 (internal loop с scheduler для каждой итерации).

---

## Низкий приоритет

### 15. Покрытие тестами

Нет тестов для:
- `resumeRun` mutation
- Concurrent runs с backpressure
- `join` с `onError` конфигурацией
- Scheduler edge cases (drift, teardown)
- Dispatcher collection filtering
