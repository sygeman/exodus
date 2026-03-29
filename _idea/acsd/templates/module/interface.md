# Module Interface

module: <module-name>

Этот документ определяет публичный контракт модуля.  
Другие модули могут взаимодействовать только через операции, описанные ниже.

---

## Dependencies

| module  | purpose     |
|---------|-------------|
| storage | persistence |

---

## Exported Types

Источник типов: `acsd/data_model.md`

Используемые DTO:

- `UserDTO`
- `CreateUserInput`
- `UpdateUserInput`

---

## Error Codes

| code | meaning |
|-----|---------|
| USER_NOT_FOUND | пользователь не существует |
| EMAIL_EXISTS | email уже используется |
| INVALID_INPUT | неверные данные |

---

## Operations

### USER-001 createUser

input: `CreateUserInput`  
output: `UserDTO`

errors:

- `EMAIL_EXISTS`
- `INVALID_INPUT`

side effects:

- create user

---

### USER-002 getUser

input: `id: ID`  
output: `UserDTO`

errors:

- `USER_NOT_FOUND`

side effects:

- none

---

### USER-003 updateUser

input: `UpdateUserInput`  
output: `UserDTO`

errors:

- `USER_NOT_FOUND`
- `INVALID_INPUT`

side effects:

- update user

---

## Contract Rules

- операции детерминированы
- ошибки возвращаются только из `Error Codes`
- DTO берутся из `acsd/data_model.md`
- внутренние структуры модуля не экспортируются
