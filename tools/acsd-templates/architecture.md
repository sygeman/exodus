# System Architecture

## 1. Overview

Система состоит из независимых модулей.  
Модули взаимодействуют только через публичные интерфейсы.

Основные свойства архитектуры:

- модульность
- контрактные интерфейсы
- изоляция реализации
- отсутствие циклических зависимостей

---

## 2. Architectural Style

Используемый стиль архитектуры:

- modular system
- contract-first modules
- explicit dependency graph

Связанные решения:

- ADR-001 Architectural Style

---

## 3. System Modules

| module | responsibility |
|------|----------------|
| api | внешние интерфейсы системы |
| auth | аутентификация и авторизация |
| user | управление пользователями |
| storage | хранение данных |

Структура модуля:


module/
acsd/
capsule.md
interface.md
architecture/
src/


---

## 4. Module Responsibilities

### api

Отвечает за:

- входные запросы
- валидацию
- orchestration

Не отвечает за:

- бизнес-логику
- хранение данных

### auth

Отвечает за:

- аутентификацию
- проверку прав

### user

Отвечает за:

- управление профилями
- операции пользователя

### storage

Отвечает за:

- персистентность данных
- доступ к базе

---

## 5. Module Dependencies

| module | allowed dependencies |
|------|----------------------|
| api | auth, user |
| auth | storage |
| user | storage |
| storage | none |

Связанные решения:

- ADR-002 Module Dependency Rules

Правила:

- зависимости должны соответствовать таблице
- циклические зависимости запрещены
- доступ только через interface.md

---

## 6. Communication Model

Модули взаимодействуют через:

- публичные интерфейсы
- DTO из global data model

Связанные решения:

- ADR-003 Inter-Module Communication

---

## 7. Data Model

Глобальная модель данных:


acsd/data_model.md


Связанные решения:

- ADR-004 Global Data Model

Правила:

- DTO определяются только там
- модули не создают альтернативные глобальные структуры

---

## 8. External Systems

| system | type |
|------|------|
| database | storage |
| external api | integration |

Связанные решения:

- ADR-005 External Integrations

---

## 9. Architectural Rules

Обязательные правила:

- модуль взаимодействует с другим модулем только через интерфейс
- запрещён импорт внутренних компонентов другого модуля
- зависимости должны соответствовать dependency graph
- глобальная модель данных едина

---

## 10. Architecture Decisions

Индекс архитектурных решений:

| ADR | описание |
|-----|---------|
| ADR-001 | Architectural Style |
| ADR-002 | Module Dependency Rules |
| ADR-003 | Inter-Module Communication |
| ADR-004 | Global Data Model |
| ADR-005 | External Integrations |

Полный список:
  acsd/adr/

---

## 11. Evolution Rules

Разрешено:

- добавление новых модулей
- расширение интерфейсов

Запрещено:

- нарушение dependency graph
- обход интерфейсов
- скрытые зависимости
