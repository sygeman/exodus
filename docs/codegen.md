# edem-codegen: Рефакторинг

## Текущие проблемы

### Критические

1. **Шаблоны ломаются** — `resolveTemplate(value, {})` вызывается с пустым контекстом, все `{{ item.name }}`, `{{ event }}`, `{{ context.projectId }}` превращаются в `""`.

2. **`v-for` не привязан к комопозаблам** — генерируется `v-for="item in projects"`, но компонент не импортирует комопозабл, переменная `projects` не определена.

3. **`ActionEvent` игнорируется** — `collectEvents()` обрабатывает только `flow` и `navigate`. `updateItem`, `deleteItem`, `createItem` из `ui.json` не генерируют код. `v-model` не создаётся.

4. **Нет route params** — `/project/:id/overview` не извлекает `:id`, компонент не получает `context.projectId`.

### Архитектурные

5. **IR — пустая обёртка** — просто прокидывает манифесты без анализа зависимостей, валидации, семантики.

6. **Нет валидации** — не проверяется существование компонентов, коллекций, флоу в кросс-референсах.

7. **`package.json` генерируется вручную** — версии захардкожены, нет `bunfig.toml`, нет `bun init`.

8. **Нет разделения на слои** — всё в одном адаптере, невозможно заменить рендерер.

---

## Новая архитектура: Pipeline как Flow

### Принцип

Пайплайн генерации — это flow. Каждый этап — нода в графе. Edem собирает себя с помощью собственных flows. Декларативно, самореферентно, расширяемо.

```
Flow: codegen-pipeline
Trigger: manual

n1: bun-init        → exec("bun init --yes")
n2: gen-bunfig      → file:write(bunfig.toml)
n3: parse-manifests  → codegen:parse()
n4: collect-deps     → codegen:collectDeps()
n5: install-deps     → exec("bun add ...")
n6: write-manifests  → file:write(edem-manifests/)
n7: generate-code    → codegen:generate()
n8: write-files      → file:write(src/)
```

### Flow-определение пайплайна

```json
{
  "id": "codegen-pipeline",
  "name": "Codegen Pipeline",
  "trigger": { "type": "manual" },
  "nodes": [
    { "id": "n1", "type": "action", "data": { "module": "codegen", "proc": "bunInit" } },
    { "id": "n2", "type": "action", "data": { "module": "codegen", "proc": "genBunfig" } },
    { "id": "n3", "type": "action", "data": { "module": "codegen", "proc": "parseManifests" } },
    { "id": "n4", "type": "action", "data": { "module": "codegen", "proc": "collectDeps" } },
    { "id": "n5", "type": "action", "data": { "module": "codegen", "proc": "installDeps" } },
    { "id": "n6", "type": "action", "data": { "module": "codegen", "proc": "writeManifests" } },
    { "id": "n7", "type": "action", "data": { "module": "codegen", "proc": "generateCode" } },
    { "id": "n8", "type": "action", "data": { "module": "codegen", "proc": "writeFiles" } }
  ],
  "edges": [
    { "id": "e1", "source": "n1", "target": "n2" },
    { "id": "e2", "source": "n2", "target": "n3" },
    { "id": "e3", "source": "n3", "target": "n4" },
    { "id": "e4", "source": "n4", "target": "n5" },
    { "id": "e5", "source": "n5", "target": "n6" },
    { "id": "e6", "source": "n6", "target": "n7" },
    { "id": "e7", "source": "n7", "target": "n8" }
  ]
}
```

### Stage как обработчик нод

Каждый stage — обработчик action-нод во flow. Stage не зависит от позиции в pipeline, только от входных данных.

```ts
interface Stage {
  name: string
  handle(input: StageInput): Promise<StageOutput>
}

interface StageInput {
  ir: IR
  output: string
  context: Record<string, unknown>
}

interface StageOutput {
  files: OutputFile[]
  deps: string[]
}
```

### Зависимости — без версий

`bunfig.toml` содержит `exact = true`. Пакеты добавляются через `bun add [names]` — bun резолвит версии сам.

```toml
# bunfig.toml
[install]
saveTextLockfile = true
exact = true
```

---

## Phase 1: IR + Парсер + Валидация

### ir.ts — Новый IR

```ts
interface IR {
  project: IRProject
  components: IRComponent[]
  routes: IRRoute[]
  collections: IRCollection[]
  flows: IRFlow[]
  layout: IRLayoutInfo
}

interface IRProject {
  name: string
  identifier: string
}

interface IRComponent {
  name: string
  tree: ComponentNode
  usedCollections: string[]
  usedFlows: string[]
  routeParams: string[]
  needsRouter: boolean
  needsEdem: boolean
  hasFormBindings: boolean
}

interface IRRoute {
  path: string
  componentName?: string
  redirect?: string
  name: string
  params: string[]
}

interface IRCollection {
  id: string
  name: string
  fields: IRField[]
  singleton: boolean
}

interface IRField {
  name: string
  type: string
  tsType: string
  required: boolean
  default?: unknown
  labels?: Record<string, string>
}

interface IRLayoutInfo {
  hasSidebar: boolean
  navigation: Array<{
    label: string
    route: string
    icon?: string
  }>
}
```

### parse.ts — Семантический анализ

- `parseComponents()` — обходит дерево, извлекает `usedCollections`, `usedFlows`, `needsRouter`, `hasFormBindings`
- `parseRoutes()` — извлекает `params` из path, генерирует имена
- `parseCollections()` — прокидывает `singleton`, маппит `tsType`

### validate.ts — Кросс-валидация

- componentName из route существует в components
- bind.collection существует в data
- event.flow существует в flows
- filter/sort поля реальны

---

## Phase 2: Stage'ы

### bunStage

Обработчик `codegen:bunInit` и `codegen:genBunfig`.

```ts
const bunStage: Stage = {
  name: "bun",
  async handle({ output }) {
    // bun init --yes
    await Bun.spawn(["bun", "init", "--yes"], { cwd: output })
    // gen bunfig.toml
    writeFileSync(join(output, "bunfig.toml"), `[install]\nsaveTextLockfile = true\nexact = true\n`)
    return { files: [], deps: [] }
  },
}
```

### electrobunStage

Обработчик `codegen:electrobun`.

Файлы:
- `electrobun.config.ts`
- `src/bun/edem.ts` — создание edem-инстанса
- `src/bun/index.ts` — BrowserWindow, RPC bridge, scheduler, dispatcher
- `src/edem-bridge.ts` — webview bridge
- `src/edem.ts` — webview proxy

Зависимости (вычисляются из IR):
- Всегда: `electrobun`, `@exodus/edem-core`
- Если есть electrobun-флоу: `@exodus/edem-electrobun`
- Если есть flows: `@exodus/edem-flows`

### vueStage

Обработчик `codegen:vue`.

Файлы:
- `src/App.vue`
- `src/main.ts`
- `src/app.css`
- `src/env.d.ts` — Vue шимы
- `src/router.ts` — имена маршрутов, params, props: true

Зависимости:
- `vue`, `vue-router`, `@nuxt/ui`
- dev: `@vitejs/plugin-vue`, `vue-tsc`

### edemDataStage

Обработчик `codegen:data`.

Файлы:
- `src/manifest.ts` — загрузка data.json
- `src/composables/use{Collection}.ts` — для каждой коллекции

Комопозаблы:
- Реактивные фильтры (watchEffect)
- Proper TypeScript интерфейсы из полей
- Singleton vs collection
- CRUD: create, update, remove
- Real-time подписки

Зависимости:
- Если есть коллекции: `@exodus/edem-data`

### edemFlowsStage

Обработчик `codegen:flows`.

Файлы:
- `src/flows-manifest.ts` — загрузка flows.json
- `src/flows-bootstrap.ts` — ensureFlows

Зависимости:
- Если есть флоу: `@exodus/edem-flows`

### appStage

Обработчик `codegen:app`.

Файлы:
- `src/components/{name}.vue` — для каждого компонента из IR
- `src/layouts/DefaultLayout.vue` — shared layout
- `.gitignore`
- `vite.config.ts`
- `tsconfig.json`
- `index.html`

---

## Phase 2: Генерация Vue компонентов

### Принцип

`{{ }}` выражения — это Vue runtime, НЕ codegen-time. Адаптер сохраняет их как есть.

### Обработка событий

**FlowEvent** → `edem.flows.trigger()`:
```json
{ "flow": "createProject" }
```
→
```vue
<script setup>
const edem = useEdem()
function handleCreateProject() {
  edem.flows.trigger({ flow_id: "createProject" })
}
</script>
<button @click="handleCreateProject">...</button>
```

**ActionEvent** → composable метод + v-model:
```json
{ "action": "updateItem", "collection": "ideas", "data": { "id": "{{ context.ideaId }}", "title": "{{ event }}" } }
```
→
```vue
<script setup>
const { items: ideas, update } = useIdeas({
  filter: { id: { _eq: route.params.ideaId } }
})
</script>
<UInput :model-value="ideas[0]?.title" @update:model-value="(v) => update(ideas[0].id, { title: v })" />
```

**NavigateEvent** → `router.push()`:
```json
{ "navigate": "/project/{{ context.projectId }}/ideas" }
```
→
```vue
<script setup>
const router = useRouter()
</script>
<button @click="router.push(`/project/${route.params.projectId}/ideas`)">...</button>
```

### v-for

```json
{ "bind": { "collection": "projects", "sort": ["sort_order"], "item": { ... } } }
```
→
```vue
<div v-for="item in projects" :key="item.id">
  <!-- children с {{ item.name }} preserved -->
</div>
```

---

## Phase 3: Модуль

### Регистрация flows + обработчиков

```ts
export const codegenModule = createEdemModule("codegen", (module) => {
  return module
    .context(async () => ({}))
    // Flow pipeline
    .flow(pipelineFlow)
    // Action handlers для нод
    .action("bunInit", bunStage.handle)
    .action("genBunfig", genBunfigHandler)
    .action("parseManifests", parseHandler)
    .action("collectDeps", collectDepsHandler)
    .action("installDeps", installDepsHandler)
    .action("writeManifests", writeManifestsHandler)
    .action("generateCode", generateHandler)
    .action("writeFiles", writeFilesHandler)
    // Мутация для запуска pipeline
    .mutation("generateProject", {
      input: z.object({
        project_id: z.string(),
        output: z.string(),
        manifests: z.any(),
      }),
      output: z.object({
        files: z.number(),
        output: z.string(),
      }),
      resolve: async ({ input }) => {
        const ir = parseManifests(input.manifests)
        // Запуск flow pipeline
        await edem.flows.trigger({ flow_id: "codegen-pipeline", input: { ir, output: input.output } })
        return { files: count, output: input.output }
      },
    })
})
```

---

## Phase 3: Конфиги

- `electrobun.config.ts` — динамическое имя из IR
- `vite.config.ts` — без хардкода
- `.gitignore` — node_modules, dist, .DS_Store
- `env.d.ts` — Vue шимы
- `tsconfig.json` — extends shared config

---

## Структура файлов пакета

```
packages/edem-codegen/src/
├── index.ts              # barrel export
├── ir.ts                 # IR типы
├── parse.ts              # manifests → IR
├── validate.ts           # кросс-валидация
├── module.ts             # edem-модуль, flow pipeline
├── pipeline.ts           # flow-определение пайплайна
├── stages/
│   ├── bun.ts            # bun init, bunfig.toml
│   ├── electrobun.ts     # platform stage
│   ├── vue.ts            # renderer stage
│   ├── data.ts           # data stage
│   ├── flows.ts          # flows stage
│   ├── app.ts            # app generation stage
│   └── index.ts          # реэкспорт
├── index.test.ts
└── __mocks__/
    ├── data.json
    ├── flows.json
    └── routes.json
```
