<script setup lang="ts">
import { computed, ref, watch, useTemplateRef, shallowRef } from "vue"
import { useRoute, useRouter, type RouteLocationRaw } from "vue-router"
import { useT } from "@exodus/edem-vue"
import { useSortable, removeNode, insertNodeAt } from "@vueuse/integrations/useSortable"
import type { SortableEvent } from "sortablejs"
import type { TreeItem } from "@nuxt/ui"
import { useCollectionQuery } from "@/hooks"
import { PROJECT_UI_COMPONENT_SOURCE_COLLECTION } from "@/project-manifest-collections"
import {
  getProjectUiComponentManifestId,
  getProjectUiComponentName,
  type ProjectUiComponentSourceItem,
} from "@/project-ui-source"
import type { ComponentNode } from "@/project-manifest-schemas"
import { getUiNodeLabel, getUiNodeIcon } from "@/project-ui-tree"
import ProjectUiComponentEditor from "@/components/ProjectUiComponentEditor.vue"
import { NUI_COMPONENTS_BY_CATEGORY, type NuiComponentMeta } from "@/generated-nuxt-ui-meta"

const t = useT()
const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)

const { data: components, loading } = useCollectionQuery(
  PROJECT_UI_COMPONENT_SOURCE_COLLECTION,
  () => ({
    filter: { project_id: { _eq: projectId.value } },
    sort: ["name"],
  }),
)

const componentItems = computed(() => components.value as unknown as ProjectUiComponentSourceItem[])
const selectedComponentId = ref<string | null>(null)
const searchQuery = ref("")
const expandedCategories = ref<Set<string>>(
  new Set(["form", "layout", "navigation", "data", "feedback", "overlay", "other"]),
)
const showSkeleton = ref(false)
const editorRef = useTemplateRef<InstanceType<typeof ProjectUiComponentEditor>>("editorRef")

// Tree items for UTree layers panel
const treeItems = shallowRef<TreeItem[]>([])
const selectedKey = ref<string | undefined>(undefined)

function buildTreeItems(): TreeItem[] {
  if (!editorRef.value) return []
  const entries = editorRef.value.nodeEntries

  function buildChildren(parentPath: number[]): TreeItem[] {
    const items: TreeItem[] = []
    for (const entry of entries) {
      if (entry.path.length !== parentPath.length + 1) continue
      if (!entry.path.slice(0, -1).every((v, i) => v === parentPath[i])) continue

      const children = buildChildren(entry.path)
      const item: TreeItem = {
        label: getUiNodeLabel(entry.node),
        icon: getUiNodeIcon(entry.node),
        slot: entry.key,
      }
      if (children.length > 0) {
        item.children = children
        item.defaultExpanded = true
      }
      items.push(item)
    }
    return items
  }

  return buildChildren([])
}

type FlatEntry = { item: TreeItem; parent: TreeItem[]; index: number }

function flatten(items: TreeItem[], parent = items): FlatEntry[] {
  return items.flatMap((item, index) => [
    { item, parent, index },
    ...(item.children?.length && item.defaultExpanded
      ? flatten(item.children as TreeItem[], item.children as TreeItem[])
      : []),
  ])
}

function getEntryPathByKey(key: string): number[] | null {
  if (!editorRef.value) return null
  const entry = editorRef.value.nodeEntries.find((e) => e.key === key)
  return entry?.path ?? null
}

function findTreeItemBySlot(items: TreeItem[], slot: string): TreeItem | undefined {
  for (const item of items) {
    if (item.slot === slot) return item
    if (item.children) {
      const found = findTreeItemBySlot(item.children as TreeItem[], slot)
      if (found) return found
    }
  }
  return undefined
}

const selectedTreeItem = computed(() => {
  if (!selectedKey.value) return undefined
  return findTreeItemBySlot(treeItems.value, selectedKey.value)
})

function handleTreeSelect(item: TreeItem, handleSelect?: () => void): void {
  if (!item.slot) return
  handleSelect?.()
  const path = getEntryPathByKey(item.slot)
  if (path) editorRef.value?.selectNode(path)
}

// Sync tree items when editor data changes
watch(
  () => editorRef.value?.nodeEntries,
  () => {
    treeItems.value = buildTreeItems()
  },
  { deep: true },
)

// Sync selection
watch(
  () => editorRef.value?.selectedNodePath,
  (path) => {
    if (!path || !editorRef.value) return
    const entry = editorRef.value.nodeEntries.find(
      (e) => e.path.length === path.length && e.path.every((v, i) => v === path[i]),
    )
    selectedKey.value = entry?.key
  },
  { deep: true },
)

// DnD via useSortable
const layersTreeRef = useTemplateRef<HTMLElement>("layersTreeRef")

useSortable(layersTreeRef, treeItems, {
  watchElement: true,
  animation: 150,
  ghostClass: "opacity-50",
  onUpdate(e: SortableEvent) {
    const { oldIndex, newIndex, item, from: fromEl } = e
    if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return
    if (!editorRef.value) return

    removeNode(item)
    insertNodeAt(fromEl, item, oldIndex)

    const flat = flatten(treeItems.value)
    const source = flat[oldIndex]
    const target = flat[newIndex]
    if (!source?.item.slot || !target?.item.slot) return

    const sourcePath = getEntryPathByKey(source.item.slot)
    const targetPath = getEntryPathByKey(target.item.slot)
    if (!sourcePath || !targetPath || sourcePath.length === 0) return

    const position = oldIndex < newIndex ? "after" : "before"
    editorRef.value.moveNodeRelative(sourcePath, targetPath, position)
  },
})

let skeletonTimeout: ReturnType<typeof setTimeout> | null = null

const selectedComponent = computed(
  () => componentItems.value.find((item) => item.id === selectedComponentId.value) ?? null,
)

const filteredProjectComponents = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (query === "") return componentItems.value

  return componentItems.value.filter((item) => {
    const name = getProjectUiComponentName(item).toLowerCase()
    const manifestId = getProjectUiComponentManifestId(item).toLowerCase()
    return name.includes(query) || manifestId.includes(query)
  })
})

const filteredNuiComponents = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const result: Record<string, NuiComponentMeta[]> = {}

  for (const [category, comps] of Object.entries(NUI_COMPONENTS_BY_CATEGORY)) {
    const filtered = comps.filter(
      (c) =>
        !query || c.name.toLowerCase().includes(query) || category.toLowerCase().includes(query),
    )
    if (filtered.length > 0) {
      result[category] = filtered
    }
  }

  return result
})

function toggleCategory(category: string): void {
  if (expandedCategories.value.has(category)) {
    expandedCategories.value.delete(category)
  } else {
    expandedCategories.value.add(category)
  }
}

function getCategoryLabel(category: string): string {
  const map: Record<string, string> = {
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

function createNuiNode(meta: NuiComponentMeta): ComponentNode {
  const node: ComponentNode = { component: meta.name }

  if (Object.keys(meta.defaults).length > 0) {
    node.props = { ...meta.defaults }
  }

  if (meta.isContainer) {
    node.children = []
  }

  return node
}

function handleAddNuiComponent(meta: NuiComponentMeta): void {
  editorRef.value?.addNode(() => createNuiNode(meta))
}

function getRouteStringParam(value: unknown): string | null {
  if (typeof value === "string") return value
  if (Array.isArray(value)) return getRouteStringParam(value[0])
  return null
}

function buildUiRouteLocation(componentId: string | null): RouteLocationRaw {
  if (!componentId) return { name: "project-ui", params: { id: projectId.value } }
  return { name: "project-ui-component", params: { id: projectId.value, componentId } }
}

function navigateUiRoute(componentId: string | null, mode: "push" | "replace" = "push"): void {
  const location = buildUiRouteLocation(componentId)
  if (mode === "replace") {
    void router.replace(location).catch(() => {})
    return
  }
  void router.push(location).catch(() => {})
}

function syncRouteToState(): void {
  const routeComponentId = getRouteStringParam(route.params.componentId)

  if (componentItems.value.length === 0) {
    selectedComponentId.value = null
    if (!loading.value && routeComponentId) navigateUiRoute(null, "replace")
    return
  }

  const routeComponent = routeComponentId
    ? componentItems.value.find((item) => item.id === routeComponentId)
    : null
  const targetComponent = routeComponent ?? componentItems.value[0]

  if (!targetComponent) {
    selectedComponentId.value = null
    return
  }

  selectedComponentId.value = targetComponent.id
  if (routeComponentId !== targetComponent.id) {
    navigateUiRoute(targetComponent.id, "replace")
  }
}

function selectComponent(id: string): void {
  selectedComponentId.value = id
  navigateUiRoute(id)
}

watch(
  loading,
  (isLoading) => {
    if (isLoading) {
      skeletonTimeout = setTimeout(() => {
        showSkeleton.value = true
      }, 150)
      return
    }
    if (skeletonTimeout) {
      clearTimeout(skeletonTimeout)
      skeletonTimeout = null
    }
    showSkeleton.value = false
  },
  { immediate: true },
)

watch(
  [
    componentItems,
    loading,
    () => route.params.id,
    () => route.params.componentId,
    () => route.name,
  ],
  syncRouteToState,
  { immediate: true },
)
</script>

<template>
  <div class="bg-elevated/10 flex h-full min-h-0">
    <aside class="flex min-h-0 w-72 shrink-0 flex-col p-3 pr-0">
      <!-- Top card: Components -->
      <div
        class="border-default bg-default flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border shadow-sm"
      >
        <div class="border-default shrink-0 border-b px-3 py-3">
          <h1 class="mb-2.5 text-sm font-semibold">
            {{ t({ en: "Components", ru: "Компоненты" }) }}
          </h1>
          <UInput
            v-model="searchQuery"
            :placeholder="t({ en: 'Search...', ru: 'Поиск...' })"
            size="sm"
            class="w-full"
          />
        </div>

        <div v-if="loading && showSkeleton" class="flex flex-1 flex-col gap-2 p-2">
          <div v-for="i in 8" :key="i" class="rounded-xl p-2">
            <USkeleton class="mb-1.5 h-3.5 w-28" />
            <USkeleton class="h-3 w-20" />
          </div>
        </div>

        <UScrollArea v-else class="min-h-0 flex-1">
          <div class="flex flex-col gap-1 p-2">
            <p
              v-if="filteredProjectComponents.length > 0"
              class="text-muted px-2 pt-1 pb-1.5 text-[10px] font-medium tracking-wider uppercase"
            >
              {{ t({ en: "Project", ru: "Проект" }) }}
            </p>

            <button
              v-for="component in filteredProjectComponents"
              :key="component.id"
              class="group relative flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors"
              :class="
                selectedComponentId === component.id ? 'bg-primary/5' : 'hover:bg-elevated/60'
              "
              @click="selectComponent(component.id)"
            >
              <span
                class="absolute top-1 bottom-1 left-0 w-0.5 rounded-full transition-opacity"
                :class="
                  selectedComponentId === component.id ? 'bg-primary opacity-100' : 'opacity-0'
                "
              />

              <span
                class="bg-elevated text-muted group-hover:text-default flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors"
                :class="selectedComponentId === component.id ? 'text-primary' : ''"
              >
                <UIcon name="i-lucide-component" class="h-3.5 w-3.5" />
              </span>

              <span class="min-w-0 flex-1">
                <span class="block truncate text-xs font-medium">
                  {{ getProjectUiComponentName(component) }}
                </span>
                <span class="text-muted block truncate font-mono text-[10px]">
                  {{ getProjectUiComponentManifestId(component) }}
                </span>
              </span>
            </button>

            <div
              v-if="
                filteredProjectComponents.length > 0 &&
                Object.keys(filteredNuiComponents).length > 0
              "
              class="border-default mx-2 my-1 border-t"
            />

            <template v-for="(comps, category) in filteredNuiComponents" :key="category">
              <button
                class="text-muted hover:text-default flex items-center gap-1.5 rounded-lg px-2 pt-2 pb-1 text-left text-[10px] font-medium tracking-wider uppercase transition-colors"
                @click="toggleCategory(category)"
              >
                <UIcon
                  :name="
                    expandedCategories.has(category)
                      ? 'i-lucide-chevron-down'
                      : 'i-lucide-chevron-right'
                  "
                  class="h-3 w-3"
                />
                <span>{{ getCategoryLabel(category) }}</span>
                <span class="text-muted/60 ml-auto">{{ comps.length }}</span>
              </button>

              <div v-if="expandedCategories.has(category)" class="flex flex-col gap-0.5">
                <button
                  v-for="comp in comps"
                  :key="comp.name"
                  class="hover:bg-elevated text-muted hover:text-default flex items-center gap-2 rounded-lg py-1 pr-2 pl-6 text-left transition-colors"
                  @click="handleAddNuiComponent(comp)"
                >
                  <span class="truncate font-mono text-xs">{{ comp.name }}</span>
                </button>
              </div>
            </template>
          </div>
        </UScrollArea>
      </div>

      <!-- Bottom card: Layers -->
      <div
        v-if="selectedComponent && editorRef"
        class="border-default bg-default mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border shadow-sm"
      >
        <div class="border-default shrink-0 border-b px-3 py-2.5">
          <p class="text-xs font-medium">
            {{ t({ en: "Layers", ru: "Слои" }) }}
          </p>
        </div>

        <UScrollArea class="min-h-0 flex-1">
          <UTree
            v-if="treeItems.length > 0"
            ref="layersTreeRef"
            :items="treeItems"
            :model-value="selectedTreeItem"
            :get-key="(i: TreeItem) => i.slot ?? i.label ?? ''"
            color="primary"
            size="sm"
            :nested="false"
            :unmount-on-hide="false"
            @update:model-value="handleTreeSelect"
          >
            <template #item-label="{ item, handleSelect }">
              <span class="cursor-grab text-xs" @click="handleTreeSelect(item, handleSelect)">
                {{ item.label }}
              </span>
            </template>
          </UTree>
          <p v-else class="text-muted px-2 py-4 text-center text-xs">
            {{ t({ en: "No nodes", ru: "Нет нод" }) }}
          </p>
        </UScrollArea>
      </div>
    </aside>

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        v-if="loading && showSkeleton"
        class="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pt-3 pb-3"
      >
        <USkeleton class="h-full min-h-[420px] w-full rounded-2xl" />
      </div>

      <div
        v-else-if="!selectedComponent"
        class="text-muted flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"
      >
        <UIcon name="i-lucide-square-pen" class="h-10 w-10" />
        <p>
          {{
            t({ en: "Select a component to continue", ru: "Выбери компонент, чтобы продолжить" })
          }}
        </p>
      </div>

      <ProjectUiComponentEditor v-else ref="editorRef" :component-item="selectedComponent" />
    </div>
  </div>
</template>
