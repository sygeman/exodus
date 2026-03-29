# Универсальный процесс разработки для стартапов

Синтез лучших практик стартапов и контракт-ориентированной разработки.

---

## 1. Ключевые принципы

### 1.1 Принципы разработки

| Принцип | Смысл | Когда применять |
|---------|--------|----------------|
| **Lean Startup** | MVP + Build-Measure-Learn циклы | Всегда, особенно на ранних стадиях |
| **Contract-First** | Контракты определяют взаимодействия | От Growth stage |
| **Interface-Driven** | Интерфейс = контракт, реализация свободна | От Growth stage |
| **Test-Driven** | Тесты гарантируют контракт | Всегда |
| **Living Documentation** | Документация живая и актуальная | Всегда |

### 1.2 Принципы архитектуры

| Принцип | Смысл | Когда применять |
|---------|--------|----------------|
| **Modular Design** | Модули с чёткими границами | От MVP |
| **Interface-Driven Design** | Интерфейсы отделены от реализации | От Growth stage |
| **ADR (Architecture Decision Records)** | Фиксация архитектурных решений | С первого дня |
| **Evolutionary Architecture** | Эволюция, не Big Design Up Front | Всегда |

### 1.3 Принципы качества

| Принцип | Смысл | Когда применять |
|---------|--------|----------------|
| **Fast Feedback** | CI/CD < 30 минут | Всегда |
| **Automated Quality Gates** | Essential gates обязательны | Всегда |
| **Coverage as Guide** | 70-80% coverage, не 100% | От Growth stage |
| **Trunk-Based Development** | Short-lived branches | От MVP |

---

## 2. Артефакты разработки

### 2.1 Документация

```
/docs
  /vision.md                        # Цели продукта (с первого дня)
  /adr/                             # Architecture Decision Records (с первого дня)
    /0001-choose-architecture.md
    /0002-adopt-contract-first.md
  /api/                             # API документация (если публичный API)
    /openapi.yaml
  /architecture/                     # Архитектурные решения (от Growth stage)
    /modules.md
    /integration.md
  /guides/                          # Командные гайды (по мере роста)
    /code-review.md
    /testing.md
```

**Essential с первого дня:**
- `vision.md` - цели продукта
- `adr/` - архитектурные решения

**Essential от Growth stage:**
- `architecture/` - архитектура системы
- `api/` - если публичный API

**Nice-to-Have:**
- `guides/` - по мере роста команды

### 2.2 Контракты

```
/contracts
  /pacts/                           # Consumer-Driven Contracts (от Growth stage)
    /frontend-backend.json
    /backend-db.json
  /schemas/                          # Data schemas (Schema-First подход)
    /events/
      /user-created.avro
    /api/
      /user.schema.json
```

**Essential от Growth stage:**
- `contracts/pacts/` - если микросервисы/модули
- `contracts/schemas/` - если event-driven streaming

### 2.3 Код и тесты

```
/src
  /core/                            # Core business logic
  /modules/                          # Модули с интерфейсами
    /user/
      /interface.ts                   # Интерфейс контракта
      /implementation.ts             # Реализация
/tests
  /unit/                            # Unit tests (70%)
  /integration/                      # Integration tests (25%)
  /e2e/                             # E2E tests (5%)
  /contract/                        # Contract tests (от Growth stage)
```

---

## 3. Процесс разработки по стадиям

### 3.1 MVP Stage (Pre-Product-Market-Fit, 0-3 месяца)

**Цель:** Быстро подтвердить гипотезу.

**Процесс:**

1. **Планирование (1 день в неделю):**
   - Определить ключевые метрики для гипотезы
   - Выбрать 1-3 фичи для фокуса
   - Создать ADR для архитектурных решений

2. **Разработка (4-5 дней):**
   - Trunk-based development (direct commits или очень короткие ветки)
   - Unit tests для critical paths
   - Daily deploys в staging

3. **Качество:**
   - Essential gates: Build + Unit tests + Lint
   - Optional: Integration tests (если есть время)
   - Code coverage: 50-60% (реалистично для MVP)

4. **Deployment:**
   - Manual deploy to production (или автоматический если настроен)
   - Мониторинг метрик (User behaviour, не code metrics)
   - Feature flags для risky features

**Essential для MVP:**
- ✅ Unit tests для critical paths
- ✅ Linting (ESLint + Prettier)
- ✅ Type safety (TypeScript strict)
- ✅ Daily deploys в staging
- ❌ Отложить: Integration tests, E2E tests, Contract testing

**Trade-offs:**
- ✅ Скорость > Качество (в разумных пределах)
- ✅ Manual testing допустим
- ❌ Технический долг копится (но норм для MVP)

---

### 3.2 Growth Stage (Product-Market-Fit, 3-12 месяцев)

**Цель:** Масштабирование продукта при сохранении скорости.

**Процесс:**

1. **Планирование (1 день в неделю):**
   - RICE/ICE для prioritization
   - Sprint planning (1-2 недели)
   - ADR для архитектурных изменений

2. **Разработка (4-5 дней):**
   - Trunk-based с short-lived branches (< 2 дня)
   - Feature flags для незавершённых фичей
   - Contract-first для новых модулей/интеграций

3. **Качество:**
   - Essential gates: Build + Unit + Integration + Lint + Security scan
   - Optional: E2E tests (для критических сценариев)
   - Code coverage: 70-80%

4. **Testing:**
   - Unit tests (70%) - на каждом коммите
   - Integration tests (25%) - на каждом PR
   - E2E tests (5%) - перед релизом

5. **Code Review:**
   - PR size < 300 строк
   - Review time < 24 часа
   - At least 1 reviewer для critical paths

6. **Deployment:**
   - Automated deploy to staging
   - Canary release (10% → 50% → 100%)
   - Feature flags для gradual rollout

**Essential для Growth:**
- ✅ Contract-first подход
- ✅ Integration tests обязательны
- ✅ Contract testing (если микросервисы/модули)
- ✅ CI/CD pipeline с automated gates
- ✅ Code review process

**Trade-offs:**
- ✅ Баланс скорости и качества
- ✅ Technical debt контролируется
- ❌ Некоторые E2E тесты отложены

---

### 3.3 Scale Stage (Product-Stage Fit, 12+ месяцев)

**Цель:** Надёжность и производительность при масштабе.

**Процесс:**

1. **Планирование (1 день в неделю):**
   - WSJF для prioritization (если Kanban)
   - Quarterly planning
   - ADR для всех архитектурных изменений

2. **Разработка (4-5 дней):**
   - Trunk-based continues
   - Advanced feature flags (gradual rollout, A/B testing)
   - Schema evolution (backwards compatible)

3. **Качество:**
   - All gates: Build + Unit + Integration + E2E + Security + Performance
   - Code coverage: 80-90%
   - Chaos engineering (если микросервисы)

4. **Testing:**
   - Full testing pyramid: Unit (60%) + Integration (25%) + E2E (10%) + Performance (5%)
   - Contract testing для всех интеграций
   - Load testing для critical paths

5. **Code Review:**
   - PR size < 200 строк
   - Review time < 48 часов (много reviewers)
   - Multiple reviewers для critical paths

6. **Deployment:**
   - Full CD pipeline (automatic на main branch)
   - Blue-Green deployments
   - Rollback в один клик

**Essential для Scale:**
- ✅ Full testing pyramid
- ✅ Performance testing
- ✅ Chaos engineering (если микросервисы)
- ✅ Security scanning (SAST/DAST)
- ✅ Monitoring + alerting (Datadog, New Relic)

**Trade-offs:**
- ✅ Качество > Скорость для critical paths
- ✅ Technical debt минимален
- ❌ Больше времени на каждую фичу

---

## 4. Контракт-ориентированная разработка

### 4.1 Когда использовать контракт-first подход

| Ситуация | Подход | Почему |
|-----------|----------|---------|
| Новая интеграция между модулями | **Контракт-first** | Чёткие границы, предотвращает tight coupling |
| Рефакторинг существующего | **Код-first, потом контракт** | Контракт отражает current state |
| Быстрый MVP/прототип | **Код-first** | Неопределённые требования |
| Микросервисы с независимыми командами | **Контракт-first** | Нужны чёткие границы |
| Public API | **API-First** | Документация = контракт |

### 4.2 Процесс контракт-ориентированной разработки

**Для новых интеграций (Contract-First):**

```
1. Определить контракт (interface.md, OpenAPI, Pact)
   ↓
2. Генерировать code stubs из контракта
   ↓
3. Реализовать бизнес-логику
   ↓
4. Написать contract tests
   ↓
5. Gap analysis (контракт vs реализация)
   ↓
6. Fix implementation
   ↓
7. Deploy
```

**Для существующего кода (Code-First):**

```
1. Написать реализацию
   ↓
2. Извлечь контракт из реализации (если нужно)
   ↓
3. Написать contract tests
   ↓
4. Gap analysis
   ↓
5. Fix implementation или контракт
   ↓
6. Deploy
```

### 4.3 Типы контрактов

| Тип контракта | Уровень | Пример |
|--------------|---------|--------|
| **Module Interface** | Модуль | `interface IUserRepository` |
| **API Contract** | HTTP API | OpenAPI spec для REST API |
| **Data Contract** | Event streaming | Avro schema для Kafka events |
| **Consumer-Driven Contract** | Микросервисы | Pact для frontend-backend |

---

## 5. Testing Pyramid для стартапов

### 5.1 Адаптированная пирамида

```
         ▲
        /E2E\      (5-10%) - Критические пользовательские сценарии
       /------\
      /Integration\  (25-30%) - Контракты между модулями
     /------------\
    /   Unit       \ (60-70%) - Быстрые, изолированные тесты
   /________________\
```

### 5.2 Когда писать какие тесты

**Unit Tests (60-70%):**
- При реализации бизнес-логики
- Для алгоритмов с условиями
- Для utility функций
- **НЕ тестируйте:** getters, setters, конфигурацию

**Integration Tests (25-30%):**
- При интеграции с внешними сервисами (API, базы данных)
- Для проверки сериализации/десериализации данных
- Для проверки контрактных обязательств (Contract Testing)
- **ОБЯЗАТЕЛЬНО:** все контракты между модулями

**E2E Tests (5-10%):**
- Только для критических пользовательских сценариев (happy path)
- Основные потоки покупки/регистрации/логина
- **НЕ пишите:** для каждого edge case

### 5.3 Code Coverage thresholds

| Стадия | Unit coverage | Integration coverage | Total coverage |
|---------|--------------|---------------------|-----------------|
| MVP | 50-60% | 20-30% | 40-50% |
| Growth | 70-80% | 40-50% | 60-70% |
| Scale | 80-90% | 60-70% | 75-85% |

**Когда coverage не имеет смысла:**
- Assertion-Free Testing (тесты без утверждений)
- Тестирование implementation details
- Гонка за 100% coverage

---

## 6. Контроль качества

### 6.1 Essential Quality Gates

**Блокируют merge (если fail):**
```yaml
Essential:
  ✅ Build succeeds
  ✅ Unit tests pass
  ✅ Lint passes
  ✅ TypeScript check passes
  ✅ No critical security vulnerabilities
```

**Optional (warn but don't block):**
```yaml
Optional:
  ⚠️ Coverage below threshold (warning)
  ⚠️ Integration tests fail (warning)
  ⚠️ E2E tests fail (warning)
  ⚠️ CodeQL findings (warning)
```

### 6.2 Static Analysis Essentials

**Essential:**
- ESLint (airbnb config)
- Prettier (форматирование)
- TypeScript strict mode
- Pre-commit hooks

**Nice-to-Have:**
- Husky (git hooks)
- lint-staged (линтинг только изменённых файлов)
- SonarQube (мультиязычный анализ)

### 6.3 Code Review Guidelines

**PR Size:**
- MVP: < 500 строк
- Growth: < 300 строк
- Scale: < 200 строк

**Review Time:**
- MVP: < 4 часа (или skip для hotfixes)
- Growth: < 24 часа
- Scale: < 48 часов

**Essential Checks:**
- ✅ All tests pass (green CI)
- ✅ PR size в пределах
- ✅ Documentation updated
- ✅ Breaking changes documented
- ✅ At least 1 approval

---

## 7. Continuous Integration/Continuous Deployment

### 7.1 CI Pipeline по стадиям

**MVP Stage:**
```yaml
# Простая CI
on: push
jobs:
  test:
    steps:
      - run: npm test        # Unit only
  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
      - run: ./deploy.sh
```

**Growth Stage:**
```yaml
# CI + Integration
on: push
jobs:
  test:
    steps:
      - run: npm run lint
      - run: npm run test:unit
      - run: npm run test:integration
  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
      - run: ./deploy.sh staging
```

**Scale Stage:**
```yaml
# Full CI/CD
on: push
jobs:
  test:           # Unit + Integration + E2E
  security-scan:  # SAST/DAST
  deploy-staging:  # Automated
  deploy-production:  # With approval
```

### 7.2 Fast Feedback Loops

| Тест | Время выполнения | Частота | Target |
|------|----------------|----------|--------|
| Unit tests | < 2 минуты | Каждый коммит | < 5 минут total |
| Integration tests | < 15 минут | Каждый PR | < 30 минут total |
| E2E tests | < 1 час | Перед релизом | < 2 часа total |

---

## 8. Branching Strategy

### 8.1 Trunk-Based Development (Рекомендуется)

**Почему Trunk-Based:**
- ✅ Меньше merge conflicts
- ✅ Быстрее feedback loop
- ✅ Меньше overhead для стартапов
- ❌ Git Flow NOT recommended для стартапов

**Small team (2-5 developers):**
```bash
# Direct commits to main для быстрого прогресса
git checkout main
git pull
# ... work ...
git push
```

**Medium team (5-15 developers):**
```bash
# Short-lived branches (< 2 дня)
git checkout main
git checkout -b feature/new-payment
# ... work, commit frequently ...
git push -u origin feature/new-payment
# Create PR, CI runs, merge
```

### 8.2 Feature Flags для trunk-based

```typescript
// LaunchDarkly или custom implementation
const flags = {
  NEW_PAYMENT_FLOW: {
    enabled: true,
    rolloutPercentage: 10,  // Canary
    userSegments: ['beta-testers']
  },
  ADVANCED_SEARCH: {
    enabled: false
  }
};

// В коде
if (flags.NEW_PAYMENT_FLOW.enabled) {
  renderNewPaymentFlow();
} else {
  renderOldPaymentFlow();
}
```

---

## 9. Trade-offs Summary

| Направление | Quality | Speed | Стартап баланс |
|-------------|----------|--------|-----------------|
| **Testing** | Высокая (много тестов) | Низкая | 70/25/5 split |
| **Coverage** | Высокая (90%+) | Низкая | 70-80% |
| **Code Review** | Высокая (глубокое) | Низкая | PR<300, review<24h |
| **CI/CD** | Высокая (полная авто) | Низкая | Essential gates auto |
| **Architecture** | Высокая (EDA, microservices) | Низкая | Modular design + ADR |
| **Documentation** | Высокая (полная) | Низкая | Vision + ADR essential |

---

## 10. Essential vs Nice-to-Have

### 10.1 Essential с первого дня

| Артефакт | Назначение |
|----------|-----------|
| **vision.md** | Цели продукта |
| **adr/** | Архитектурные решения |
| **Unit tests** | Критические пути |
| **Linting** | ESLint + Prettier |
| **Type safety** | TypeScript strict |
| **Daily deploys** | В staging |

### 10.2 Essential от Growth stage

| Артефакт | Назначение |
|----------|-----------|
| **Contract-first** | Контракты между модулями |
| **Integration tests** | Контракты |
| **Contract testing** | Pacts |
| **CI/CD pipeline** | Automated gates |
| **Code review process** | Качество кода |
| **ADR tracking** | Автоматизация |

### 10.3 Nice-to-Have (от Scale stage)

| Артефакт | Назначение |
|----------|-----------|
| **Full E2E suite** | Полнота сценариев |
| **Performance testing** | Нагрузка |
| **Chaos engineering** | Fault tolerance |
| **Security scanning** | SAST/DAST |
| **Coverage > 90%** | Полное покрытие |

---

## 11. Источники

Основано на исследованиях авторитетных источников:

**Процессы стартапов:**
- Martin Fowler - Continuous Integration, Testing Pyramid
- Microsoft - Circuit Breaker Pattern
- Trunk-Based Development official guide
- GitHub - CI/CD Best Practices
- Lean Startup methodology

**Контракт-ориентированная разработка:**
- Thoughtworks - CDC authors
- Pact.io - Consumer-Driven Contracts
- Spring Cloud Contract documentation
- Google - Interface-Driven Design
- O'Reilly - Domain-Driven Design

**Тестирование и качество:**
- Google Testing Blog - Testing at Scale
- Kent C. Dodds - Testing Trophy
- Airbnb JavaScript Style Guide
- Jest documentation
- ESLint documentation

**Дополнительные источники:**
- Netflix Engineering Blog - Chaos Engineering
- Uber Engineering Blog - Event-Driven Architecture
- Shopify Engineering Blog - Plugin architecture
- Facebook Engineering - Continuous Code Review
