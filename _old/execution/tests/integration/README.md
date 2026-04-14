# Execution Integration Tests

These tests require the execution service to be running in Docker.

## Setup

1. Start the execution service:

```bash
cd /Users/sygeman/personal/exodus
docker compose up execution -d
```

2. Wait for service to be ready (port 8081)

3. Run tests:

```bash
cd execution
bun test tests/integration/
```

## Environment Variables

- `KIMI_API_KEY` — API ключ для тестов с реальной моделью (опционально)

## Test Structure

- `docker.test.ts` — базовые HTTP endpoint тесты
- `callback.test.ts` — тесты callback-ов с mock сервером
- `model-detection.test.ts` — тесты определения модели

## Notes

- Тесты используют `host.docker.internal` для связи с mock сервером
- Callback тесты запускают mock HTTP сервер на порту 9999
- Таймаут для callback тестов: 35 секунд
