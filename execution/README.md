# Exodus Execution

Изолированный слой выполнения задач.

Он:

- получает snapshot из State
- получает задачу от Control
- запускает агента через ACP (opencode, qwencode и т.д.)
- работает в чистом runtime (sandbox / container / process isolation)
- ограничен skills, заданными Control
- возвращает результат как изменения (diff / artifacts)
- уничтожается или сбрасывается после выполнения

**Execution не сохраняет память и не накапливает состояние.**
