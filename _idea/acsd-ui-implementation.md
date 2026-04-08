# ACSD UI Implementation Insights

## Созданная структура

```
ui/app/
├── types/acsd.ts                    # Типы ACSDNode, ACSDEdge
├── components/acsd/
│   ├── ACSDGraph.vue                # Основной граф (VueFlow)
│   ├── ACSDNodePanel.vue            # Правая панель (всегда видна)
│   ├── ACSDDialogPanel.vue          # Нижняя панель чата
│   ├── nodes/
│   │   └── ACSDNode.vue             # Нода с цветом по уровню
│   └── edges/
│       └── ACSDEdge.vue             # Связь с цветом по типу
└── pages/projects/[id].vue          # Обновлена с ACSD табом
```

## Ключевые решения

### 1. Автолейаут сверху вниз (TB)
```typescript
// dagre конфигурация
rankdir: 'TB',        // сверху вниз
nodesep: 40,          // горизонтальный отступ
ranksep: 60,          // вертикальный отступ
```

### 2. Цвета по уровням
- L0: amber (Vision)
- L1: blue (Design)
- L2: green (Specification)
- L3: purple (Contract)
- L4: neutral (Code)

### 3. Gap-ноды
- Пунктирная рамка
- Прозрачность 50%
- Текст "[?]"

### 4. Правая панель
- Всегда видна
- Показывает детали выбранной ноды
- Если ничего не выбрано — статистика проекта
- Gap — предлагает создать
- Exists — кнопки действий

### 5. Чат-панель
- Минимальная (только input)
- Stateless (нет истории)
- Отправка сообщения → action

## Интеграция в проект

Страница проекта (`/projects/[id]`) теперь имеет:
- Таб ACSD с трехпанельным layout
- Моковые данные для демо
- Выбор ноды → обновление правой панели

## Что дальше

1. **API в Control** — эндпоинт `/projects/:id/acsd/graph`
2. **Реальные данные** — заменить mockNodes/mockEdges
3. **Действия** — обработка кнопок в панели
4. **Чат-интеграция** — отправка контекста в LLM
