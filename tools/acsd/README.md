# ACSD Reconcile

**Skills для OpenCode Agent** — каскадная валидация ACSD с SQLite.

## Структура Skills

- **.agents/skills/acsd/SKILL.md** — Macro cycle coordinator skill
- **.agents/skills/acsd-microcycle/SKILL.md** — Microcycle task skill

## Реализация

- **core/database.ts** — SQLite база данных для хранения состояния
- **core/microcycle.ts** — Навигация по каскаду, функции оптимизации
- **cli/bin/acsd-helper.ts** — CLI для работы с базой данных

## Функционал

1. **Database** — SQLite база данных для надежного хранения состояния:
   - ACID транзакции (атомарность операций)
   - WAL режим (Write-Ahead Logging) для durability
   - Автоматическое восстановление после сбоев
   - Индексы для быстрого поиска файлов

2. **getParentsToRoot(filePath, rootFilePath)** — находит всех родителей файла до root (on-demand)
3. **getFirstGenerationChildren(filePath)** — находит все файлы на уровнях ниже (on-demand)
4. **getFileMetadata(filePath)** — возвращает mtime и checksum (SHA-256) файла
5. **canSkip(filePath, metadata)** — проверяет можно ли пропустить валидацию файла
6. **CLI** — запускает операции с базой данных, возвращает JSON

## Оптимизация

Файлы пропускаются при валидации если:
- Файл существует в кеше `.ascd/state.db`
- Файл ранее был VALID
- mtime и checksum не изменились
- Все родительские файлы VALID

## Как работают Skills

Skills загружаются автоматически OpenCode agent'ом по frontmatter в SKILL.md файлах:

```yaml
---
name: acsd
description: Macro cycle coordinator for ACSD cascade validation
license: MIT
compatibility: opencode
metadata:
  workflow: cascade
  role: coordinator
---
```

Когда пользователь запрашивает валидацию ACSD, agent автоматически загружает skill `acsd` и выполняет описанный алгоритм.

## База данных SQLite

ACSD использует SQLite для надежного хранения состояния:

- **ACID транзакции** — гарантируют целостность данных
- **WAL режим** — обеспечивает durability и параллельное чтение
- **Автоматическое восстановление** — после сбоев
- **Индексы** — для быстрого поиска файлов
- **Никогда не будет поврежденный файл** — атомарность операций

### Схема базы данных

```sql
-- Глобальное состояние процесса
CREATE TABLE state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL,  -- STARTED, COMPLETED, FAILED
  files_processed INTEGER DEFAULT 0,
  errors_found INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- Состояние файлов
CREATE TABLE files (
  path TEXT PRIMARY KEY,
  status TEXT NOT NULL,  -- PROCESSING, ERROR, OK
  mtime INTEGER,
  checksum TEXT,
  updated_at INTEGER NOT NULL
);

-- Отношения родитель-потомок
CREATE TABLE file_relations (
  parent_path TEXT NOT NULL,
  child_path TEXT NOT NULL,
  PRIMARY KEY (parent_path, child_path),
  FOREIGN KEY (parent_path) REFERENCES files(path) ON DELETE CASCADE,
  FOREIGN KEY (child_path) REFERENCES files(path) ON DELETE CASCADE
);

-- Индексы для производительности
CREATE INDEX idx_files_status ON files(status);
CREATE INDEX idx_files_mtime_checksum ON files(mtime, checksum);
CREATE INDEX idx_relations_parent ON file_relations(parent_path);
CREATE INDEX idx_relations_child ON file_relations(child_path);
```

## Использование CLI (для тестирования)

```bash
# Инициализация базы данных
bun run init-db

# Получить состояние файла
bun run helper get-file-state acsd/vision.md

# Обновить состояние файла (FileState JSON через stdin)
echo '{"status":"OK","mtime":1234567890,"checksum":"abc123","parents":[],"children":[]}' | bun run helper update-file-state acsd/vision.md

# Удалить состояние файла
bun run helper delete-file-state acsd/vision.md

# Проверить можно ли пропустить валидацию файла
bun run helper can-skip acsd/vision.md

# Получить родительские файлы
bun run helper get-parents acsd/vision.md

# Получить дочерние файлы
bun run helper get-children acsd/vision.md

# Получить глобальное состояние
bun run helper get-global-state

# Создать backup базы данных
bun run backup-db

# Проверить целостность базы данных
bun run integrity-check

# Очистить базу данных
bun run clean-db
```

## Преимущества SQLite

**Надежность:**
- ✅ ACID транзакции (атомарность операций)
- ✅ WAL режим (Write-Ahead Logging) для durability
- ✅ Автоматическое восстановление после сбоев
- ✅ Встроенная проверка целостности
- ✅ Никогда не будет поврежденный файл

**Производительность:**
- ✅ Индексы для быстрых запросов (особенно `canSkip`)
- ✅ Prepared statements для повторных операций
- ✅ Эффективные операции UPDATE (без чтения всего файла)
- ✅ Масштабируемость на тысячи файлов

**Удобство:**
- ✅ Нативная поддержка SQLite в Bun (без зависимостей)
- ✅ Backup и восстановление базы
- ✅ Возможность аналитических запросов

## Skill Auto-detection

OpenCode автоматически обнаруживает skills в `.agents/skills/*/SKILL.md` по frontmatter.
Agent видит список доступных skills и загружает их по необходимости.
