# Global Data Model

Этот документ определяет глобальные структуры данных системы.

Правила:

- структуры используются всеми модулями
- структуры описывают форму данных
- детали хранения не определяются
- изменения должны быть обратимо совместимыми

Связанные решения:

- ADR-D001 Global Data Model

---

## 1. Naming Rules

Правила именования:

- DTO заканчиваются на `DTO`
- идентификаторы называются `id`
- timestamp поля используют `createdAt`, `updatedAt`
- boolean поля начинаются с `is` или `has`

---

## 2. Primitive Types

Используемые базовые типы:

| type | описание |
|-----|---------|
| ID | уникальный идентификатор |
| Timestamp | время |
| Email | email строка |
| URL | ссылка |
| JSON | произвольная структура |

---

## 3. Core Entities

### User


UserDTO


| field | type | description |
|------|------|-------------|
| id | ID | уникальный идентификатор |
| email | Email | email пользователя |
| name | string | имя |
| createdAt | Timestamp | дата создания |

Инварианты:

- email уникален
- id неизменяем

---

### Session


SessionDTO


| field | type | description |
|------|------|-------------|
| id | ID | идентификатор сессии |
| userId | ID | владелец |
| expiresAt | Timestamp | срок действия |

Инварианты:

- session связан с user
- session может истечь

---

## 4. Value Objects

### Token

| field | type |
|------|------|
| value | string |
| expiresAt | Timestamp |

---

## 5. Relationships

| from | to | relation |
|-----|----|----------|
| User | Session | one-to-many |

---

## 6. Data Transfer Rules

Правила передачи данных между модулями:

- используется только DTO
- внутренние структуры модулей не экспортируются
- DTO должны быть сериализуемыми

---

## 7. Versioning Rules

Правила изменения модели:

разрешено:

- добавление новых полей
- добавление новых DTO

запрещено:

- удаление полей
- изменение типа существующих полей

breaking changes требуют:

- новый DTO
- ADR

---

## 8. Serialization

Формат передачи данных:

- JSON

Правила:

- camelCase
- null не используется
- отсутствующие поля считаются undefined
