# Intent Service Architecture

## Overview

Intent Service — слой интерпретации смысла и стабилизации намерений.

## Components

### 1. Discovery Mode
- Создание тезисов/инсайдов
- Споры и аргументация
- Накопление контекста
- Граф связей между тезисами

### 2. Stabilization Mode
- Формулирование намерения из тезисов
- Уточнение через диалог
- Фиксация Vision
- Проверка понимания перед Delivery

## Data Model

### Thesis (Тезис)
```
id: string
text: string
created_at: timestamp
session_id: string
status: draft | validated | rejected | implemented
```

### Link (Связь)
```
from_thesis_id: string
to_thesis_id: string
type: supports | contradicts | implements | derives_from
```

### Session (Сессия Discovery)
```
id: string
started_at: timestamp
context: string
intent_id: string | null
```

## API Endpoints

- `POST /theses` — создать тезис
- `GET /theses` — список тезисов
- `GET /theses/:id` — конкретный тезис
- `POST /theses/:id/links` — создать связь
- `GET /graph` — граф связей
- `POST /sessions` — начать сессию
- `POST /sessions/:id/stabilize` — сформировать Intent

## Technology Stack

- Language: TypeScript
- Runtime: Bun
- Database: SQLite (MVP) → PostgreSQL (scale)
- API: HTTP/REST или gRPC

## Integration

- Input: User via UI/Chat
- Output: Stabilized Intent → Control Service
- Storage: Git (via Control) for Delivery artifacts
