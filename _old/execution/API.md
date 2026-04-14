# Execution API

HTTP API для выполнения задач через OpenCode AI.

## Базовый URL

```
http://localhost:8081
```

## Эндпоинты

### POST /execute

Запускает задачу на выполнение.

**Параметры:**

| Поле           | Тип    | Обязательное | Описание                                |
| -------------- | ------ | ------------ | --------------------------------------- |
| task_id        | string | да           | Уникальный идентификатор задачи         |
| command        | string | да           | Команда/запрос для AI                   |
| callback_url   | string | да           | URL для отправки результатов            |
| working_dir    | string | нет          | Рабочая директория (default: /projects) |
| model.provider | string | нет          | Провайдер модели (default: kimi)        |
| model.modelId  | string | нет          | ID модели (default: k2-thinking)        |
| model.apiKey   | string | нет          | API ключ провайдера                     |
| role_prompt    | string | нет          | Системный промпт/роль                   |

**Пример запроса:**

```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "command": "Создай React компонент кнопки",
  "callback_url": "http://control:8080/callback",
  "model": {
    "provider": "kimi",
    "modelId": "k2-thinking",
    "apiKey": "sk-..."
  },
  "role_prompt": "Ты senior React разработчик"
}
```

**Ответ (200 OK):**

```json
{
  "success": true,
  "status": "accepted",
  "task_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Ошибка (400 Bad Request):**

```json
{
  "success": false,
  "error": "Missing required fields: task_id, command, callback_url"
}
```

### Callback

После завершения задачи отправляется POST на `callback_url`:

```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "result": "import React...",
  "error": null,
  "exit_code": 0
}
```

**При ошибке:**

```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "failed",
  "result": null,
  "error": "Failed to initialize OpenCode session",
  "exit_code": 1
}
```

### Chunk Streaming

Частичные результаты отправляются на `callback_url` с заменой `/executor` на `/executor/chunk`:

```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "chunk": "import React from 'react';",
  "chunk_type": "text"
}
```

### GET /health

Проверка доступности сервиса.

**Ответ (200 OK):**

```json
{
  "status": "ok"
}
```

## Примеры

### curl

```bash
curl -X POST http://localhost:8081/execute \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "123",
    "command": "Hello world",
    "callback_url": "http://localhost:3000/callback"
  }'
```
