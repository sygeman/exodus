# i18n в генераторе

## Суть

`children` и строковые пропсы принимают объект с языками вместо строки. Codegen оборачивает в `t()`.

## Пример

### Вход — `NotFound.json`:

```json
{
  "component": "div",
  "children": [
    { "component": "h1", "children": { "en": "Page not found", "ru": "Страница не найдена" } },
    { "component": "UButton", "children": { "en": "Back to projects", "ru": "Назад к проектам" } }
  ]
}
```

### Выход — `NotFound.vue`:

```vue
<script setup lang="ts">
import { useT } from "@/composables/useT"
const t = useT()
</script>

<template>
  <h1>{{ t({ en: "Page not found", ru: "Страница не найдена" }) }}</h1>
  <UButton>{{ t({ en: "Back to projects", ru: "Назад к проектам" }) }}</UButton>
</template>
```

## Как codegen отличает перевод от компонента

`children` может быть: `string | ComponentNode[] | Record<string, string>`

Проверка: `'component' in obj`. Если нет — это перевод.

- `ComponentNode` **всегда** имеет ключ `component`
- Объект перевода **никогда** не имеет ключа `component` — только коды языков

## Изменения в файлах

### 1. `packages/edem-ui/src/schemas.ts`

Расширить `children` в `ComponentNode`:

```ts
children?: ComponentNode[] | string | Record<string, string>
```

В Zod schema:

```ts
children: z.union([z.array(componentNodeSchema), z.string(), z.record(z.string(), z.string())]).optional(),
```

### 2. `packages/edem-codegen/src/ir.ts`

Без изменений. `ExtendedComponentNode` наследует `children` из `ComponentNode` автоматически.

### 3. `packages/edem-codegen/src/expressions.ts`

Добавить:

```ts
// Проверяет что объект — перевод (нет ключа component)
function isTranslation(obj: unknown): obj is Record<string, string>

// Рендер t() вызова: t({ en: 'Delete', ru: 'Удалить' })
function renderT(translations: Record<string, string>): string
```

### 4. `packages/edem-codegen/src/stages/app/template.ts`

В `renderNode()` при обработке `children`:

```ts
// Строка — как есть
if (typeof node.children === "string") { ... }

// Объект без component — перевод
if (typeof node.children === "object" && !Array.isArray(node.children) && !("component" in node.children)) {
  return `${indent}<${tag}${props}${ifAttr}${events}>${renderT(node.children)}</${tag}>`
}
```

В `renderProps()` — аналогично для строковых значений пропсов:

```ts
// Если значение пропса — объект с языками
if (typeof value === "object" && value !== null && !("component" in value)) {
  return ` :${attr}="${renderT(value as Record<string, string>)}"`
}
```

Правила:
- `{{ }}` выражения — не трогаем, даже если объект перевода
- Объект перевода в `children` → `{{ t({...}) }}`
- Объект перевода в пропсах → `:attr="t({...})"`
- Объект перевода в `modal.title`, `modal.description`, `empty.text` → аналогично

### 5. `packages/edem-codegen/src/stages/app/script.ts`

Если `comp.tree` содержит переводы (проверка через `someInTree`):

```ts
const hasTranslations = someInTree(comp.tree, (n) => {
  if (typeof n.children === "object" && !Array.isArray(n.children) && !("component" in n.children)) return true
  if (n.props) {
    for (const v of Object.values(n.props)) {
      if (typeof v === "object" && v !== null && !("component" in v)) return true
    }
  }
  return false
})

if (hasTranslations) {
  imports.push(`import { useT } from "@/composables/useT"`)
  statements.push(`const t = useT()`)
}
```

### 6. `packages/edem-codegen/src/stages/app/index.ts`

Без изменений. `useT.ts` уже существует в `apps/exodus/src/composables/useT.ts`.

## Правила

| Значение | Оборачивается в t()? | Пример |
|----------|---------------------|--------|
| Объект с языками в children | Да | `{ "en": "Delete", "ru": "Удалить" }` → `t({...})` |
| Объект с языками в пропсе | Да | `title: { "en": "Settings", "ru": "Настройки" }` → `:title="t({...})"` |
| Строка | Нет | `"Delete"` — как есть |
| Выражение | Нет | `"{{ item.title }}"` — как есть |
| Микс | Нет | `"{{ total }} logs"` — как есть |
| CSS класс | Нет | `class: "flex h-full"` — как есть |
| Иконка | Нет | `name: "i-lucide-settings"` — как есть |

## Порядок реализации

1. Schema (edem-ui) — расширить `children` тип
2. Expressions — `isTranslation`, `renderT`
3. Template rendering — обработка объектов перевода в children и пропсах
4. Script generation — `useT` импорт если есть переводы
5. Mock обновление + тесты

## Тесты

1. Юнит-тест `isTranslation()` — объект с языками да, ComponentNode нет, строка нет, null нет
2. Юнит-тест `renderT()` — корректный вывод для одного языка, нескольких языков, кавычек в тексте
3. Интеграционный тест — обновить мок NotFound.json с переводами, проверить сгенерированный .vue
4. Регрессионный тест — компоненты без переводов генерируются без изменений
