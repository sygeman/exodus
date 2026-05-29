<script setup lang="ts">
import { computed, ref, onErrorCaptured } from "vue"
import { useT } from "@exodus/edem-vue"
import {
  NUI_COMPONENTS,
  NUI_COMPONENTS_BY_CATEGORY,
  type NuiComponentMeta,
} from "@/generated-nuxt-ui-meta"
import { UI_NODE_TEMPLATE_OPTIONS, createDefaultUiNode } from "@/project-ui-node-templates"
import type { ComponentNode } from "@/project-manifest-schemas"
import ProjectUiPreviewNode from "@/components/ProjectUiPreviewNode.vue"

defineOptions({ name: "ProjectUiAddComponentModal" })

const open = defineModel<boolean>("open", { default: false })

const emit = defineEmits<{
  select: [component: string]
}>()

const t = useT()
const searchQuery = ref("")
const selectedComponent = ref<string | null>(null)

type ComponentItem = {
  component: string
  label: string
  icon: string
  category: string
  meta?: NuiComponentMeta
}

const allComponents = computed<ComponentItem[]>(() => {
  const items: ComponentItem[] = []

  for (const item of UI_NODE_TEMPLATE_OPTIONS) {
    if (item.group === "html") {
      items.push({
        component: item.component,
        label: item.label,
        icon: item.icon ?? "i-lucide-square",
        category: "html",
      })
    }
  }

  for (const [category, comps] of Object.entries(NUI_COMPONENTS_BY_CATEGORY)) {
    for (const meta of comps) {
      items.push({
        component: meta.name,
        label: meta.name,
        icon: "i-lucide-component",
        category,
        meta,
      })
    }
  }

  return items
})

const filteredBySearch = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return allComponents.value
  return allComponents.value.filter(
    (c) => c.component.toLowerCase().includes(query) || c.label.toLowerCase().includes(query),
  )
})

const groupedComponents = computed(() => {
  const groups: Record<string, ComponentItem[]> = {}
  for (const item of filteredBySearch.value) {
    if (!groups[item.category]) groups[item.category] = []
    groups[item.category].push(item)
  }
  return groups
})

const categoryOrder = [
  "html",
  "layout",
  "form",
  "data",
  "feedback",
  "navigation",
  "overlay",
  "other",
]

const sortedCategories = computed(() => {
  return Object.keys(groupedComponents.value).toSorted(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b),
  )
})

const selectedMeta = computed(() => {
  if (!selectedComponent.value) return null
  return allComponents.value.find((c) => c.component === selectedComponent.value) ?? null
})

const previewError = ref(false)

onErrorCaptured(() => {
  previewError.value = true
  return false
})

const previewNode = computed<ComponentNode | null>(() => {
  if (!selectedComponent.value || previewError.value) return null
  const meta = NUI_COMPONENTS[selectedComponent.value]
  if (meta) {
    const node: ComponentNode = { component: meta.name }
    if (Object.keys(meta.defaults).length > 0) {
      node.props = { ...meta.defaults }
    }
    if (meta.isContainer) {
      node.children = []
    }
    return node
  }
  return createDefaultUiNode(selectedComponent.value)
})

function getCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    html: "HTML",
    layout: "Layout",
    form: "Form",
    data: "Data",
    feedback: "Feedback",
    navigation: "Navigation",
    overlay: "Overlay",
    other: "Other",
  }
  return map[category] ?? category
}

function handleSelect(component: string): void {
  selectedComponent.value = component
  previewError.value = false
}

function handleAdd(): void {
  if (!selectedComponent.value) return
  emit("select", selectedComponent.value)
  open.value = false
  selectedComponent.value = null
  searchQuery.value = ""
}

function handleOpenChange(value: boolean): void {
  if (!value) {
    selectedComponent.value = null
    searchQuery.value = ""
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :ui="{
      content:
        'w-[min(900px,calc(100vw-2rem))] max-w-none max-h-[80vh] divide-y-0 divide-transparent rounded-2xl',
      body: 'p-0 overflow-hidden',
    }"
    @update:open="handleOpenChange"
  >
    <template #header>
      <p class="text-lg font-semibold">
        {{ t({ en: "Add component", ru: "Добавить компонент" }) }}
      </p>
    </template>

    <template #body>
      <div class="flex h-[500px]">
        <!-- Left: search + list -->
        <div class="border-default flex w-72 shrink-0 flex-col border-r">
          <div class="p-3">
            <UInput
              v-model="searchQuery"
              :placeholder="t({ en: 'Search...', ru: 'Поиск...' })"
              icon="i-lucide-search"
            />
          </div>

          <div class="flex-1 overflow-x-hidden overflow-y-auto px-2 pb-2">
            <div v-for="category in sortedCategories" :key="category" class="mb-2">
              <p class="text-muted px-2 py-0.5 text-xs font-medium tracking-wider uppercase">
                {{ getCategoryLabel(category) }}
              </p>

              <button
                v-for="item in groupedComponents[category]"
                :key="item.component"
                class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors"
                :class="
                  selectedComponent === item.component
                    ? 'bg-elevated text-default'
                    : 'text-muted hover:bg-elevated/50 hover:text-default'
                "
                @click="handleSelect(item.component)"
              >
                <UIcon :name="item.icon" class="h-4 w-4 shrink-0" />
                <span class="truncate text-sm">{{ item.label }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Right: details -->
        <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div v-if="selectedMeta" class="flex min-h-0 flex-1 flex-col">
            <div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
              <div v-if="previewNode" class="border-default mx-4 mt-4 rounded-xl border p-3">
                <ProjectUiPreviewNode :node="previewNode" />
              </div>

              <div class="p-4">
                <div class="mb-3 flex items-center gap-3">
                  <div
                    class="bg-elevated flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  >
                    <UIcon :name="selectedMeta.icon" class="h-5 w-5" />
                  </div>
                  <div class="min-w-0">
                    <p class="text-default truncate font-medium">
                      {{ selectedMeta.label }}
                    </p>
                    <p class="text-muted text-xs">
                      {{ getCategoryLabel(selectedMeta.category) }}
                    </p>
                  </div>
                </div>

                <div v-if="selectedMeta.meta" class="mb-3">
                  <p class="text-muted mb-0.5 text-xs font-medium tracking-wider uppercase">
                    {{ t({ en: "Type", ru: "Тип" }) }}
                  </p>
                  <p class="text-sm">
                    {{ selectedMeta.meta.isContainer ? "Container" : "Leaf" }}
                  </p>
                </div>

                <div
                  v-if="selectedMeta.meta && Object.keys(selectedMeta.meta.props).length > 0"
                  class="mb-3"
                >
                  <p class="text-muted mb-1.5 text-xs font-medium tracking-wider uppercase">
                    {{ t({ en: "Props", ru: "Свойства" }) }}
                  </p>
                  <div class="space-y-1">
                    <div
                      v-for="(prop, name) in selectedMeta.meta.props"
                      :key="name"
                      class="flex min-w-0 items-baseline gap-2 text-sm"
                    >
                      <code
                        class="text-default bg-elevated shrink-0 rounded px-1.5 py-0.5 text-xs"
                        >{{ name }}</code
                      >
                      <span class="text-muted shrink-0 text-xs">{{ prop.type }}</span>
                      <span v-if="prop.defaultValue" class="text-muted truncate text-xs">
                        = {{ prop.defaultValue }}
                      </span>
                    </div>
                  </div>
                </div>

                <div v-if="selectedMeta.meta && Object.keys(selectedMeta.meta.defaults).length > 0">
                  <p class="text-muted mb-1.5 text-xs font-medium tracking-wider uppercase">
                    {{ t({ en: "Defaults", ru: "По умолчанию" }) }}
                  </p>
                  <pre
                    class="text-default bg-elevated min-w-0 overflow-x-auto rounded-lg p-3 text-xs break-words whitespace-pre-wrap"
                    >{{ JSON.stringify(selectedMeta.meta.defaults, null, 2) }}</pre
                  >
                </div>

                <p v-if="!selectedMeta.meta" class="text-muted text-sm">
                  {{ t({ en: "HTML element", ru: "HTML-элемент" }) }}
                </p>
              </div>
            </div>

            <div class="border-default flex shrink-0 justify-end border-t p-3">
              <UButton @click="handleAdd">
                {{ t({ en: "Add", ru: "Добавить" }) }}
              </UButton>
            </div>
          </div>

          <div v-else class="flex flex-1 items-center justify-center">
            <p class="text-muted text-sm">
              {{ t({ en: "Select a component", ru: "Выберите компонент" }) }}
            </p>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
